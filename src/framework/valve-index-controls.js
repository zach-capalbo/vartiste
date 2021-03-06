var registerComponent = AFRAME.registerComponent;//require('../core/component').registerComponent;
var bind = AFRAME.utils.bind;//require('../utils/bind');

var trackedControlsUtils = AFRAME.utils.trackedControls//require('../utils/tracked-controls');
var checkControllerPresentAndSetup = trackedControlsUtils.checkControllerPresentAndSetup;
var emitIfAxesChanged = trackedControlsUtils.emitIfAxesChanged;
var onButtonEvent = trackedControlsUtils.onButtonEvent;

var INDEX_CONTROLLER_MODEL_BASE_URL = 'https://cdn.aframe.io/controllers/valve/index/valve_index_';
var INDEX_CONTROLLER_MODEL_URL = {
  left: INDEX_CONTROLLER_MODEL_BASE_URL + 'left.gltf',
  right: INDEX_CONTROLLER_MODEL_BASE_URL + 'right.gltf'
};

var GAMEPAD_ID_PREFIX = 'valve';

var INDEX_CONTROLLER_POSITION_OFFSET = {
  left: {x: -0.00023692678902063457, y: 0.04724540367838371, z: -0.061959880395271096},
  right: {x: 0.002471558599671131, y: 0.055765208987076195, z: -0.061068168708348844}
}

var INDEX_CONTROLLER_ROTATION_OFFSET = {
  left: {_x: 0.692295102620542, _y: -0.0627618864318427, _z: -0.06265893149611756, _order: "XYZ"},
  right: {_x: 0.6484021229942998, _y: -0.032563619881892894, _z: -0.1327973171917482, _order: "XYZ"}
}

/**
 * Vive controls.
 * Interface with Vive controllers and map Gamepad events to controller buttons:
 * trackpad, trigger, grip, menu, system
 * Load a controller model and highlight the pressed buttons.
 */
module.exports.Component = registerComponent('valve-index-controls', {
  schema: {
    hand: {default: 'left'},
    buttonColor: {type: 'color', default: '#FAFAFA'},  // Off-white.
    buttonHighlightColor: {type: 'color', default: '#22D1EE'},  // Light blue.
    model: {default: true},
    orientationOffset: {type: 'vec3'}
  },

  /**
   * Button IDs:
   * 0 - trackpad
   * 1 - trigger (intensity value from 0.5 to 1)
   * 2 - grip
   * 3 - menu (dispatch but better for menu options)
   * 4 - system (never dispatched on this layer)
   */
  mapping: {
    axes: {trackpad: [0, 1]},
    buttons: [
      // 'trackpad', 'trigger', 'grip', 'menu',
      // 'system', 'finger1', 'finger2', 'finger3',
      // 'finger4', 'finger5']
      'trigger', 'grip', 'joystick', 'abutton', 'abutton',
      'system', 'finger1', 'finger2', 'finger3',
      'finger4', 'finger5']
  },

  init: function () {
    var self = this;
    this.controllerPresent = false;
    this.lastControllerCheck = 0;
    this.onButtonChanged = bind(this.onButtonChanged, this);
    this.onButtonDown = function (evt) { onButtonEvent(evt.detail.id, 'down', self); };
    this.onButtonUp = function (evt) { onButtonEvent(evt.detail.id, 'up', self); };
    this.onButtonTouchEnd = function (evt) { onButtonEvent(evt.detail.id, 'touchend', self); };
    this.onButtonTouchStart = function (evt) { onButtonEvent(evt.detail.id, 'touchstart', self); };
    this.previousButtonValues = {};
    this.rendererSystem = this.el.sceneEl.systems.renderer;

    this.bindMethods();
  },

  play: function () {
    this.checkIfControllerPresent();
    this.addControllersUpdateListener();
  },

  pause: function () {
    this.removeEventListeners();
    this.removeControllersUpdateListener();
  },

  bindMethods: function () {
    this.onModelLoaded = bind(this.onModelLoaded, this);
    this.onControllersUpdate = bind(this.onControllersUpdate, this);
    this.checkIfControllerPresent = bind(this.checkIfControllerPresent, this);
    this.removeControllersUpdateListener = bind(this.removeControllersUpdateListener, this);
    this.onAxisMoved = bind(this.onAxisMoved, this);
  },

  addEventListeners: function () {
    var el = this.el;
    el.addEventListener('buttonchanged', this.onButtonChanged);
    el.addEventListener('buttondown', this.onButtonDown);
    el.addEventListener('buttonup', this.onButtonUp);
    el.addEventListener('touchend', this.onButtonTouchEnd);
    el.addEventListener('touchstart', this.onButtonTouchStart);
    el.addEventListener('model-loaded', this.onModelLoaded);
    el.addEventListener('axismove', this.onAxisMoved);
    this.controllerEventsActive = true;
  },

  removeEventListeners: function () {
    var el = this.el;
    el.removeEventListener('buttonchanged', this.onButtonChanged);
    el.removeEventListener('buttondown', this.onButtonDown);
    el.removeEventListener('buttonup', this.onButtonUp);
    el.removeEventListener('touchend', this.onButtonTouchEnd);
    el.removeEventListener('touchstart', this.onButtonTouchStart);
    el.removeEventListener('model-loaded', this.onModelLoaded);
    el.removeEventListener('axismove', this.onAxisMoved);
    this.controllerEventsActive = false;
  },

  /**
   * Once OpenVR returns correct hand data in supporting browsers, we can use hand property.
   * var isPresent = checkControllerPresentAndSetup(this.el.sceneEl, GAMEPAD_ID_PREFIX,
                                                        { hand: data.hand });
   * Until then, use hardcoded index.
   */
  checkIfControllerPresent: function () {
    var data = this.data;
    var controllerIndex = data.hand === 'right' ? 0 : data.hand === 'left' ? 1 : 2;
    checkControllerPresentAndSetup(this, GAMEPAD_ID_PREFIX, {index: controllerIndex, iterateControllerProfiles: true, hand: data.hand});
  },

  injectTrackedControls: function () {
    var el = this.el;
    var data = this.data;

    // If we have an OpenVR Gamepad, use the fixed mapping.
    el.setAttribute('tracked-controls', {
      idPrefix: GAMEPAD_ID_PREFIX,
      // Hand IDs: 1 = right, 0 = left, 2 = anything else.
      controller: data.hand === 'right' ? 1 : data.hand === 'left' ? 0 : 2,
      hand: data.hand,
      orientationOffset: data.orientationOffset
    });

    this.loadModel();
  },

  loadModel: function () {
    var data = this.data;
    if (!data.model) { return; }
    this.el.setAttribute('gltf-model', '' + INDEX_CONTROLLER_MODEL_URL[data.hand] + '');
  },

  addControllersUpdateListener: function () {
    this.el.sceneEl.addEventListener('controllersupdated', this.onControllersUpdate, false);
  },

  removeControllersUpdateListener: function () {
    this.el.sceneEl.removeEventListener('controllersupdated', this.onControllersUpdate, false);
  },

  onControllersUpdate: function () {
    this.checkIfControllerPresent();
  },

  /**
   * Rotate the trigger button based on how hard the trigger is pressed.
   */
  onButtonChanged: function (evt) {
    var button = this.mapping.buttons[evt.detail.id];
    //console.log("button", evt.detail.id, button, evt.detail.state.value)
    var buttonMeshes = this.buttonMeshes;
    var analogValue;

    if (!button) { return; }

    if (button === 'trigger') {
      analogValue = evt.detail.state.value;
      // Update trigger rotation depending on button value.
      if (buttonMeshes && buttonMeshes.trigger) {
        buttonMeshes.trigger.rotation.x = -analogValue * (Math.PI / 12);
      }
    }

    // Pass along changed event with button state, using button mapping for convenience.
    this.el.emit(button + 'changed', evt.detail.state);
  },

  onModelLoaded: function (evt) {
    var buttonMeshes;
    var controllerObject3D = evt.detail.model;
    var self = this;

    //console.log("Loaded model", this.data.model, controllerObject3D)

    if (!this.data.model) { return; }

    // Store button meshes object to be able to change their colors.
    buttonMeshes = this.buttonMeshes = {};
    buttonMeshes.grip = {
      left: controllerObject3D.getObjectByName('leftgrip'),
      right: controllerObject3D.getObjectByName('rightgrip')
    };
    buttonMeshes.menu = controllerObject3D.getObjectByName('menubutton');
    buttonMeshes.system = controllerObject3D.getObjectByName('systembutton');
    buttonMeshes.trackpad = controllerObject3D.getObjectByName('touchpad');
    buttonMeshes.trigger = controllerObject3D.getObjectByName('trigger');

    // Set default colors.
    Object.keys(buttonMeshes).forEach(function (buttonName) {
      self.setButtonColor(buttonName, self.data.buttonColor);
    });

    // Offset pivot point.
    controllerObject3D.position.copy(INDEX_CONTROLLER_POSITION_OFFSET[this.data.hand]);
    controllerObject3D.rotation.copy(INDEX_CONTROLLER_ROTATION_OFFSET[this.data.hand]);

    this.el.emit('controllermodelready', {
      name: 'valve-index-controlls',
      model: this.data.model,
      rayOrigin: new THREE.Vector3(0, 0, 0)
    })
  },

  onAxisMoved: function (evt) {
    //console.log("Axis moved", evt.detail.axis)
    emitIfAxesChanged(this, this.mapping.axes, evt);
  },

  updateModel: function (buttonName, evtName) {
    var color;
    var isTouch;
    if (!this.data.model) { return; }
    return;

    isTouch = evtName.indexOf('touch') !== -1;
    // Don't change color for trackpad touch.
    if (isTouch) { return; }

    // Update colors.
    color = evtName === 'up' ? this.data.buttonColor : this.data.buttonHighlightColor;
    this.setButtonColor(buttonName, color);
  },

  setButtonColor: function (buttonName, color) {
    var buttonMeshes = this.buttonMeshes;
    var rendererSystem = this.rendererSystem;

    if (!buttonMeshes) { return; }
    //console.log("Meshes", this.buttonMeshes)
    return

    // Need to do both left and right sides for grip.
    if (buttonName === 'grip') {
      buttonMeshes.grip.left.material.color.set(color);
      buttonMeshes.grip.right.material.color.set(color);
      rendererSystem.applyColorCorrection(buttonMeshes.grip.left.material.color);
      rendererSystem.applyColorCorrection(buttonMeshes.grip.right.material.color);
      return;
    }
    buttonMeshes[buttonName].material.color.set(color);
    rendererSystem.applyColorCorrection(buttonMeshes[buttonName].material.color);
  }
});
