var trackedControlsUtils = AFRAME.utils.trackedControls//require('../utils/tracked-controls');
var checkControllerPresentAndSetup = trackedControlsUtils.checkControllerPresentAndSetup;

var isWebXRAvailable = AFRAME.utils.device.isWebXRAvailable;

var GAMEPAD_ID_STEAMVR = 'oculus-oculus-rift-s';
var GAMEPAD_ID_WEBXR = 'oculus-touch';

AFRAME.registerComponent('fix-oculus-steamvr', {
  dependencies: ['oculus-touch-controls'],
  init() {
    let touchComponent = this.el.components['oculus-touch-controls']
    let oldCheck = touchComponent.checkIfControllerPresent

    let checkIfControllerPresent = function () {
      if (!isWebXRAvailable) {
        checkControllerPresentAndSetup(this, GAMEPAD_ID_PREFIX, {
          hand: this.data.hand
        });
        return;
      }

      if (this.controllerPresent) {
        checkControllerPresentAndSetup(this, this.webXRId, {
          hand: this.data.hand
        });

        if (!this.controllerPresent) {
          this.webXRId = undefined;
        }
        return;
      }

      this.webXRId = GAMEPAD_ID_WEBXR;
      checkControllerPresentAndSetup(this, GAMEPAD_ID_WEBXR, {
        hand: this.data.hand
      });

      if (this.controllerPresent) {
        return;
      }

      this.webXRId = GAMEPAD_ID_STEAMVR;
      checkControllerPresentAndSetup(this, GAMEPAD_ID_STEAMVR, {
        hand: this.data.hand
      });

      if (this.controllerPresent) {
        return;
      }

      this.webXRId = undefined;
    };

    let injectTrackedControls = function () {
      var data = this.data;
      var webXRId =this.webXRId;
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
