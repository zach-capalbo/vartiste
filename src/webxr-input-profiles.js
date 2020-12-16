import {Util} from './util.js'
import { fetchProfile, MotionController, Constants } from '@webxr-input-profiles/motion-controllers/dist/motion-controllers.module.js'

// Implements the webxr-input-profiles motion-controllers package. Use the
// [`webxr-motion-controller`](#webxr-motion-controller) in your scene to use this system
AFRAME.registerSystem('webxr-input-profiles', {
  schema: {
    // Base URL for the profiles and assets from the @webxr-input-profiles/assets package
    url: {default: "https://unpkg.com/@webxr-input-profiles/assets@latest/dist/profiles"},
    disableTrackedControls: {default: true},
    webVRPolyfill: {default: true},
  },
  start() {
    this.start = function() {};
    this.tick = AFRAME.utils.throttleTick(this._tick, 100, this)
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

    this.updateControllerList = this.updateControllerList.bind(this)
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
    if (this.el.sceneEl.xrSession !== this.connectedSession)
    {
      if (this.connectedSession)
      {
        this.connectedSession.removeEventListener('inputsourceschange', this.updateControllerList)
      }

      this.connectedSession = this.el.sceneEl.xrSession;
      if (this.connectedSession)
      {
        this.connectedSession.addEventListener('inputsourceschange', this.updateControllerList)
        this.updateControllerList()
      }
    }
  },
  async updateControllerList() {
    let xrSession = this.el.sceneEl.xrSession;
    if (!xrSession) return;

    let sources = xrSession.inputSources

    for (let controller of this.motionControllers.values())
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
        m.seen = true
        this.motionControllers.set(input, m)
        this.loadingControllers.delete(input)
        // console.log("Added new motion contorller", m)
      }
    }

    for (let controller of this.motionControllers.values())
    {
      if (!controller.seen)
      {
        // console.log("Removing controller", controller)
        this.motionControllers.delete(controller.xrInputSource)
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

    originSpace: {oneOf: ['targetRaySpace', 'gripSpace'], default: 'targetRaySpace'},

    fallbackToLaserControls: {default: true},
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
    }
  },
  init() {
    if (!navigator.xr)
    {
      console.log("No webXR, falling back to laser controls")
      this.pause()
      this.enabled = false
      this.data.enabled = false
      this.tick = function() {};
      this.el.setAttribute('laser-controls', `hand: ${this.data.hand}`)
      Util.whenLoaded(this.el, () => {
        // this.el.removeAttribute('webxr-laser')
        // this.el.removeAttribute('smoothed-webxr-motion-controller')
        // this.el.removeAttribute('webxr-motion-controller')
      })
      return
    }
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

    this.rayMatrix = new THREE.Matrix4();
    this.rayForward = new THREE.Vector3();
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
    let pose = frame.getPose(this.controller[this.data.originSpace], this.system.referenceSpace)

    var object3D = this.el.object3D;
    if (!pose) { return; }
    this.hasUpdatedPose = true;
    object3D.matrix.elements = pose.transform.matrix;
    object3D.matrix.decompose(object3D.position, object3D.rotation, object3D.scale);

    if (!this.el.getObject3D('mesh')) return
    if (this.setPoseController === this.controller) return;
    this.setPoseController = this.controller

    if (this.data.originSpace === 'gripSpace')
    {
      let objectRayPose = frame.getPose(this.controller.targetRaySpace, this.controller.gripSpace)
      this.rayMatrix.elements = objectRayPose.transform.matrix;
      this.rayMatrix.extractRotation(this.rayMatrix)
      let forward = new THREE.Vector3(0, 0, -1)
      forward.applyMatrix4(this.rayMatrix)
      this.el.setAttribute('raycaster', {direction: forward})
    }
    else
    {
      let gripPose = frame.getPose(this.controller.gripSpace, this.controller.targetRaySpace)
      this.rayMatrix.elements = gripPose.transform.matrix
      let mesh = this.el.getObject3D('mesh')
      // mesh.updateMatrix()
      mesh.matrix.compose(mesh.position, mesh.quaternion, mesh.scale)
      mesh.matrix.multiply(this.rayMatrix)
      Util.applyMatrix(mesh.matrix, mesh)
    }
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


var EVENTS = {
  CLICK: 'click',
  FUSING: 'fusing',
  MOUSEENTER: 'mouseenter',
  MOUSEDOWN: 'mousedown',
  MOUSELEAVE: 'mouseleave',
  MOUSEUP: 'mouseup'
};

var STATES = {
  FUSING: 'cursor-fusing',
  HOVERING: 'cursor-hovering',
  HOVERED: 'cursor-hovered'
};

// Replacement for A-Frame's built-in `laser-controls`
// Much of this code comes from A-FRAME cursor component: https://github.com/aframevr/aframe/blob/v1.1.0/src/components/cursor.js
// and is licensed under the MIT License.
AFRAME.registerComponent('webxr-laser', {
  dependencies: [''],
  events: {
    webxrcontrollerset: function(e) {
      this.el.setAttribute('raycaster', 'showLine', true)
    },
    triggerup: function(e) {
      if (!this.intersectedEl) return;
      this.eventDetail.intersection = this.el.components.raycaster.getIntersection(this.intersectedEl);
      this.twoWayEmit('click')
    },
    'raycaster-intersection': function(evt) {
      var currentIntersection;
      var cursorEl = this.el;
      var index;
      var intersectedEl;
      var intersection;

      // Select closest object, excluding the cursor.
      index = evt.detail.els[0] === cursorEl ? 1 : 0;
      intersection = evt.detail.intersections[index];
      intersectedEl = evt.detail.els[index];

      // If cursor is the only intersected object, ignore the event.
      if (!intersectedEl) { return; }

      // Already intersecting this entity.
      if (this.intersectedEl === intersectedEl) { return; }

      // Ignore events further away than active intersection.
      if (this.intersectedEl) {
        currentIntersection = this.el.components.raycaster.getIntersection(this.intersectedEl);
        if (currentIntersection && currentIntersection.distance <= intersection.distance) { return; }
      }

      // Unset current intersection.
      this.clearCurrentIntersection(true);

      this.setIntersection(intersectedEl, intersection);
    },
    'raycaster-intersection-cleared': function(evt) {
      var clearedEls = evt.detail.clearedEls;
      // Check if the current intersection has ended
      if (clearedEls.indexOf(this.intersectedEl) === -1) { return; }
      this.clearCurrentIntersection();
    }
  },
  init() {
    this.eventDetail = {cursorEl: this.el};
    this.intersectedEventDetail = {cursorEl: this.el}
    if (!this.el.hasAttribute('smoothed-webxr-motion-controller'))
    {
      this.el.setAttribute('webxr-motion-controller', this.getAttribute('webxr-laser'))
      this.el.setAttribute('smoothed-webxr-motion-controller')
    }
  },
  clearCurrentIntersection(ignoreRemaining) {
    if (!this.intersectedEl) { return; }

    this.intersectedEl.removeState(STATES.HOVERED);
    this.el.removeState(STATES.HOVERING);
    this.twoWayEmit(EVENTS.MOUSELEAVE);

    this.intersectedEl = null;
    if (ignoreRemaining === true) { return; }
    let intersections = this.el.components.raycaster.intersections;
    if (intersections.length === 0) { return; }
    // Exclude the cursor.
    let index = intersections[0].object.el === this.cursorEl ? 1 : 0;
    let intersection = intersections[index];
    if (!intersection) { return; }
    this.setIntersection(intersection.object.el, intersection);
  },
  setIntersection(intersectedEl, intersection) {
    var cursorEl = this.el;
    var data = this.data;
    var self = this;

    // Already intersecting.
    if (this.intersectedEl === intersectedEl) { return; }

    // Set new intersection.
    this.intersectedEl = intersectedEl;

    // Hovering.
    cursorEl.addState(STATES.HOVERING);
    intersectedEl.addState(STATES.HOVERED);
    this.twoWayEmit(EVENTS.MOUSEENTER);
  },
  twoWayEmit(evtName) {
    var el = this.el;
    var intersectedEl = this.intersectedEl;
    var intersection;

    intersection = this.el.components.raycaster.getIntersection(intersectedEl);
    this.eventDetail.intersectedEl = intersectedEl;
    this.eventDetail.intersection = intersection;
    el.emit(evtName, this.eventDetail);

    if (!intersectedEl) { return; }

    this.intersectedEventDetail.intersection = intersection;
    intersectedEl.emit(evtName, this.intersectedEventDetail);
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
    if (!this.el.components['webxr-motion-controller']) return;

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
