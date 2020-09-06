var trackedControlsUtils = AFRAME.utils.trackedControls//require('../utils/tracked-controls');
var checkControllerPresentAndSetup = trackedControlsUtils.checkControllerPresentAndSetup;

var isWebXRAvailable = AFRAME.utils.device.isWebXRAvailable;

var GAMEPAD_ID_STEAMVR = 'oculus-oculus-rift-s';

AFRAME.registerComponent('fix-oculus-steamvr', {
  dependencies: ['oculus-touch-controls'],
  init() {
    let touchComponent = this.el.components['oculus-touch-controls']
    let oldCheck = touchComponent.checkIfControllerPresent

    let checkIfControllerPresent = function () {
      // oldCheck()
      checkControllerPresentAndSetup(this, GAMEPAD_ID_STEAMVR, {
        hand: this.data.hand
      });
    };

    let injectTrackedControls = function () {
      var data = this.data;
      var webXRId = GAMEPAD_ID_STEAMVR;
      var webVRId = data.hand === 'right' ? 'Oculus Touch (Right)' : 'Oculus Touch (Left)';
      var id = isWebXRAvailable ? webXRId : webVRId;
      this.el.setAttribute('tracked-controls', {
        id: id,
        hand: data.hand,
        orientationOffset: data.orientationOffset
      });
      this.loadModel();
    };

    touchComponent.checkIfControllerPresent = checkIfControllerPresent.bind(touchComponent)
    touchComponent.injectTrackedControls = injectTrackedControls.bind(touchComponent)
  }
})
