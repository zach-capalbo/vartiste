import { fetchProfile, MotionController, Constants } from '@webxr-input-profiles/motion-controllers/dist/motion-controllers.module.js'

Object.assign(window, { fetchProfile, MotionController })

AFRAME.registerSystem('webxr-input-profiles', {
  schema: {
    url: {default: "https://unpkg.com/@webxr-input-profiles/assets@1.0.5/dist/profiles"}
  },
  init() {
    // this.tick = AFRAME.utils.throttleTick(this.tick, 500, this)
    this.motionControllers = new Map();
    this.loadingControllers = new Set();

    this.updateReferenceSpace = this.updateReferenceSpace.bind(this);
    this.el.addEventListener('enter-vr', this.updateReferenceSpace);
    this.el.addEventListener('exit-vr', this.updateReferenceSpace);
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
          'tracked-controls-webxr uses reference space "' + refspace + '".');
      throw err;
    });
  },
  tick() {
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
        this.motionControllers.get(input).updateFromGamepad()
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
        this.loadingControllers.remove(input)
        console.log("Added new motion contorller", m)
      }
    }

    for (let controller of Object.values(this.motionControllers))
    {
      if (!controller.seen)
      {
        console.log("Removing controller", controller)
        this.motionControllers.remove(controller.xrInputSource)
      }
    }
  }
})

AFRAME.registerComponent('webxr-input-profiles', {
  data: {
    hand: {oneOf: ['left', 'right']}
  },
  init() {
    // this.tick = AFRAME.utils.throttleTick(this.tick, 600, this)
    this.lastComponentState = new Map();
    this.lastButtonAmount = new Map();
    this.lastXAxis = new Map();
    this.lastYAxis = new Map();
    this.changedDetail = {value: 0.0};
    this.movedDetail = {axis: [0, 0]};
  },
  remove() {

  },
  update() {

  },
  tick(t, dt) {
    this.checkForController()
    this.updatePose()
    this.updateButtons()
  },
  updatePose() {
    if (!this.controller) return
    let frame = this.el.sceneEl.frame
    let pose = frame.getPose(this.controller.targetRaySpace, this.system.referenceSpace)
    // console.log("pose", pose)
    var object3D = this.el.object3D;
    if (!pose) { return; }
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
      default:
        console.log("Unkown component type", component.type, component)
        return component.type
    }
  },
  updateButtons() {
    if (!this.controller) return;

    for (let component of Object.values(this.controller.components))
    {
      if (!component.values || !component.values.state) continue;
      let state = component.values.state

      if (!this.lastComponentState.has(component))
      {
        this.lastComponentState.set(component, 'default')
      }

      if (this.lastComponentState.get(component) !== state)
      {
        console.log("State change")

        let eventState = ""

        if (state === Constants.ComponentState.PRESSED)
        {
          eventState = "down"
        }
        else
        {
          eventState = "up"
        }

        event = this.getAFrameComponentName(component) + eventState;

        this.lastComponentState.set(component, state)

        console.log("Handling component event", event, component)
        this.el.emit("buttonchanged", {id: component.gamepadIndices.button, state})
        this.el.emit(event, {id: component.gamepadIndices.button, state})
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
  }
})

AFRAME.registerComponent('webxr-laser', {
  dependencies: ['cursor'],
  events: {
    webxrcontrollerset: function(e) {
      this.el.setAttribute('raycaster', 'showLine', true)
    }
  }
})
