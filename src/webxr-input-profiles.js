import {Util} from './util.js'
import { fetchProfile, MotionController, Constants } from '@webxr-input-profiles/motion-controllers/dist/motion-controllers.module.js'

// Implements the webxr-input-profiles motion-controllers package. Use the
// [`webxr-motion-controller`](#webxr-motion-controller) in your scene to use this system
AFRAME.registerSystem('webxr-input-profiles', {
  schema: {
    // Base URL for the profiles and assets from the @webxr-input-profiles/assets package
    url: {default: "https://unpkg.com/@webxr-input-profiles/assets@1.0.5/dist/profiles"},
    disableTrackedControls: {default: true}
  },
  start() {
    this.start = function() {};
    this.tick = AFRAME.utils.throttleTick(this._tick, 500, this)
    this.motionControllers = new Map();
    this.loadingControllers = new Set();

    this.updateReferenceSpace = this.updateReferenceSpace.bind(this);
    this.el.addEventListener('enter-vr', this.updateReferenceSpace);
    this.el.addEventListener('exit-vr', this.updateReferenceSpace);

    if (this.data.disableTrackedControls)
    {
      this.el.systems['tracked-controls-webxr'].pause()
      this.el.systems['tracked-controls-webxr'].tick = function() {};
    }
  },
  updateReferenceSpace() {
    var self = this;
    var xrSession = this.el.xrSession;

    if (!xrSession) {
      this.referenceSpace = undefined;
      this.controllers = [];
      if (this.oldControllersLength > 0) {
        this.oldControllersLength = 0;
        this.el.emit('controllersupdated', undefined, false);
      }
      return;
    }
    var refspace = self.el.sceneEl.systems.webxr.sessionReferenceSpaceType;
    xrSession.requestReferenceSpace(refspace).then(function (referenceSpace) {
      self.referenceSpace = referenceSpace;
    }).catch(function (err) {
      self.el.sceneEl.systems.webxr.warnIfFeatureNotRequested(
          refspace,
          'webxr-input-profiles uses reference space "' + refspace + '".');
      throw err;
    });
  },
  tick() {},
  _tick() {
    this.updateControllerList()
  },
  async updateControllerList() {
    let xrSession = this.el.sceneEl.xrSession;
    if (!xrSession) return;

    let sources = xrSession.inputSources

    for (let controller of Object.values(this.motionControllers))
    {
      controller.seen = false
    }

    // fetchProfile($('a-scene').xrSession.inputSources[0], "https://unpkg.com/@webxr-input-profiles/assets@1.0.5/dist/profiles").then((r) => window.prof = r)
    for (let input of sources)
    {
      if (this.motionControllers.has(input))
      {
        this.motionControllers.get(input).seen = true
      }
      else if (this.loadingControllers.has(input))
      {
        continue;
      }
      else
      {
        this.loadingControllers.add(input)
        let prof = await fetchProfile(input, this.data.url)
        let m = new MotionController(input, prof.profile, prof.assetPath)
        this.motionControllers.set(input, m)
        this.loadingControllers.delete(input)
        // console.log("Added new motion contorller", m)
      }
    }

    for (let controller of Object.values(this.motionControllers))
    {
      if (!controller.seen)
      {
        // console.log("Removing controller", controller)
        this.motionControllers.remove(controller.xrInputSource)
      }
    }
  }
})

// Represents a tracked motion controller from the webxr-input-profiles package.
// Replacement for A-Frame's built-in tracked-controls
AFRAME.registerComponent('webxr-motion-controller', {
  schema: {
    // **[left, right]** Handed controller to attach to
    hand: {oneOf: ['left', 'right']},

    // If true, hides extraneous tracking features from the model which can get in the way
    hideTrackingMesh: {default: false},

    // If true, uses model's "pointing" rotation for pointing the raycaster direction. (Setting the raycaster's origin is still under development)
    usePointingPose: {default: true},
  },
  events: {
    object3dset: function(e) {
      // console.log("object3dset", e)
      let mesh = this.el.getObject3D('mesh')
      if (!mesh) return;

      (() => {
        if (!this.data.hideTrackingMesh) return
        let trackingMesh = mesh.getObjectByName('TRACKING_MESH')
        if (!trackingMesh) return
        trackingMesh.visible = false
      })();

      (() => {
        if (!this.data.usePointingPose) return;
        let pointingPose = mesh.getObjectByName('POINTING_POSE')
        if (!pointingPose) return;
        let forward = new THREE.Vector3(0, 1, 0)
        forward.applyQuaternion(pointingPose.quaternion)
        this.el.setAttribute('raycaster', {direction: forward})
      })();
    }
  },
  init() {
    this.system = this.el.sceneEl.systems['webxr-input-profiles']
    this.system.start();
    // this.tick = AFRAME.utils.throttleTick(this.tick, 600, this)
    this.lastComponentState = new Map();
    this.lastComponentEventState = new Map();
    this.lastButtonAmount = new Map();
    this.lastXAxis = new Map();
    this.lastYAxis = new Map();
    this.changedDetail = {value: 0.0};
    this.movedDetail = {axis: [0, 0]};
  },
  remove() {
    let mesh = this.el.getObject3D('mesh')
    if (mesh)
    {
      mesh.remove()
      this.el.setObject3D('mesh', undefined)
    }
  },
  tick(t, dt) {
    this.checkForController()
    this.updatePose()
    this.updateButtons()
  },
  updatePose() {
    if (!this.controller) return
    let frame = this.el.sceneEl.frame
    if (!frame) return;
    let pose = frame.getPose(this.controller.targetRaySpace, this.system.referenceSpace)
    // console.log("pose", pose)
    var object3D = this.el.object3D;
    if (!pose) { return; }
    this.hasUpdatedPose = true;
    object3D.matrix.elements = pose.transform.matrix;
    object3D.matrix.decompose(object3D.position, object3D.rotation, object3D.scale);
  },
  getAFrameComponentName(component)
  {
    switch (component.type) {
      case 'squeeze': return "grip"; break;
      case 'thumbstick': return "thumbstick"; break;
      case 'touchpad': return "trackpad"; break;
      case 'trigger': return "trigger"; break;
      case 'button': return component.id.split("-").join(""); break;
      default:
        console.warn("Unkown component type", component.type, component)
        return component.type
    }
  },
  updateButtons() {
    if (!this.controller) return;

    this.controller.updateFromGamepad()

    for (let component of Object.values(this.controller.components))
    {
      this.updateComponentVisuals(component);
      if (!component.values || !component.values.state) continue;
      let state = component.values.state

      if (!this.lastComponentState.has(component))
      {
        this.lastComponentState.set(component, 'default')
      }

      if (this.lastComponentState.get(component) !== state)
      {
        // console.log("State change")

        let eventState = ""

        if (state === Constants.ComponentState.PRESSED)
        {
          eventState = "down"
        }
        else
        {
          eventState = "up"
        }

        if (eventState !== this.lastComponentEventState.get(component))
        {
          event = this.getAFrameComponentName(component) + eventState;

          this.lastComponentState.set(component, state)
          this.lastComponentEventState.set(component, eventState)

          // console.log("Handling component event", component, state, this.el, event)
          this.el.emit("buttonchanged", {id: component.gamepadIndices.button, state})
          this.el.emit(event, {id: component.gamepadIndices.button, state})
        }
      }

      if (component.type === 'squeeze' || component.type === 'trigger')
      {
        if (component.values.button !== this.lastButtonAmount.get(component))
        {
          this.changedDetail.value = component.values.button
          this.el.emit(this.getAFrameComponentName(component) + "changed", this.changedDetail)
          this.lastButtonAmount.set(component, component.values.button)
        }
      }
      else if (component.type === 'touchpad' || component.type === 'thumbstick')
      {
        if (component.values.xAxis !== this.lastXAxis.get(component) ||
            component.values.yAxis !== this.lastYAxis.get(component))
        {
          this.movedDetail.axis[0] = component.values.xAxis
          this.movedDetail.axis[1] = component.values.yAxis
          this.el.emit('axismove', this.movedDetail)
          this.lastXAxis.set(component, component.values.xAxis)
          this.lastYAxis.set(component, component.values.yAxis)
        }
      }
    }
  },
  updateComponentVisuals(component) {
    let motionControllerRoot = this.el.getObject3D('mesh')
    if (!motionControllerRoot) return;

    for (let visualResponse of Object.values(component.visualResponses))
    {
      const valueNode = motionControllerRoot.getObjectByName(visualResponse.valueNodeName);

      // Calculate the new properties based on the weight supplied
      if (visualResponse.valueNodeProperty === 'visibility') {
        valueNode.visible = visualResponse.value;
      } else if (visualResponse.valueNodeProperty === 'transform') {
        const minNode = motionControllerRoot.getObjectByName(visualResponse.minNodeName);
        const maxNode = motionControllerRoot.getObjectByName(visualResponse.maxNodeName);

        THREE.Quaternion.slerp(
          minNode.quaternion,
          maxNode.quaternion,
          valueNode.quaternion,
          visualResponse.value
        );

        valueNode.position.lerpVectors(
          minNode.position,
          maxNode.position,
          visualResponse.value
        );
      }
    }
  },
  checkForController() {
    if (this.controller && !this.system.motionControllers.has(this.controller.xrInputSource))
    {
      this.controller = undefined
    }
    if (this.controller) return;

    for (let controller of this.system.motionControllers.values())
    {
      if (controller.xrInputSource.handedness === this.data.hand)
      {
        this.el.setAttribute('gltf-model', controller.assetUrl)
        this.controller = controller
        this.el.emit('webxrcontrollerset', {controller})
      }
    }
  },
})

// Replacement for A-Frame's built-in `laser-controls`
AFRAME.registerComponent('webxr-laser', {
  dependencies: [''],
  events: {
    webxrcontrollerset: function(e) {
      this.el.setAttribute('raycaster', 'showLine', true)
    },
    triggerup: function(e) {
      if (this.el.components.raycaster.intersections.length == 0) return

      let intersection
      let closestDistance = 9999
      let d
      for (let i of this.el.components.raycaster.intersections)
      {
        d = i.distance
        if (d < closestDistance)
        {
          intersection = i
          closestDistance = d
        }
      }
      if (!intersection) return
      let el = intersection.object.el

      this.eventDetail.intersection = intersection
      el.emit('click', this.eventDetail)
    }
  },
  init() {
    this.eventDetail = {cursorEl: this.el};
    if (!this.el.hasAttribute('smoothed-webxr-motion-controller'))
    {
      this.el.setAttribute('webxr-motion-controller', this.getAttribute('webxr-laser'))
      this.el.setAttribute('smoothed-webxr-motion-controller')
    }
  }
})

// Applies motion smoothing to a `webxr-motion-controller` on the same entity
AFRAME.registerComponent('smoothed-webxr-motion-controller', {
  dependencies: ['webxr-motion-controller'],
  schema: {
    // **[0..1]** How much smoothing to apply. 0 means no smoothing, 1 means infinite smoothing (i.e., the controller never moves)
    amount: {default: 0.8},
  },
  init() {
    let smoothing = this;

    (function() {
      this.oldMatrix = new THREE.Matrix4()
      this.oldUpdatePose = this.updatePose.bind(this)
      this.newMatrix = new THREE.Matrix4()
      this.smoothing = smoothing
    }).call(this.el.components['webxr-motion-controller'])

    this.el.components['webxr-motion-controller'].updatePose = this.updatePose.bind(this.el.components['webxr-motion-controller'])
  },
  updatePose: function() {
    if (!this.controller) return
    this.oldMatrix.copy(this.el.object3D.matrix)
    this.oldUpdatePose.call(this)
    if (!this.hasUpdatedPose) return
    Util.interpTransformMatrices(1.0 - this.smoothing.data.amount, this.oldMatrix, this.el.object3D.matrix, {result: this.newMatrix})
    Util.applyMatrix(this.newMatrix, this.el.object3D)
  }
})
