import {Util} from './util.js'
const ENTER_CONROLLER_SVG = require('url-loader!./enter-controller.svg').default

// Allows the use of VR 6DoF controllers while still rendering to the desktop
// monitor. This works best when used in conjunction with the
// [`vartiste-user-root`](#vartiste-user-root) component. It is possible to use
// it with your own user rig, as long as it has these components with this
// structure:
//
//```
//     - a-entity camera=""
//         - a-entity id="hand-offset"
//           - a-entity id="hand-root"
//             - a-entity id="right-hand" webxr-motion-controller="hand:right"
//             - a-entity id="left-hand" webxr-motion-controller="hand:left"
//```
//
// When the `enterSession` is called, a new xrSession will be created, though
// nothing will be rendered to the HMD. After `orientationResetDelay`
// milliseconds, `resetHandRootPosition` will be called to set the position and
// orientation of the controllers to match the current camera position. Ideally,
// users should be pointing their controllers forward in a comfortable neutral
// position when this occurs.
//
// If you do not use the `addUseControllerButton` property, then you will need
// to call the `enterSession` method from a user event (e.g., a click) in order
// to start using the controllers.
//
// (*Note: this is only compatible with the aframe-vartiste-toolkit
// [`webx-motion-controller`](#webxr-motion-controller) or
// [`webxr-laser`](#webxr-laser) components. It is not compatible
// with the A-Frame built-in tracked-controls.*)
AFRAME.registerSystem('xr-controllers-only', {
  schema: {
    // If not using the [`vartiste-user-root`](#vartiste-user-root), this
    // selector should indicate the element which corresponds to the left handed
    // controller.
    leftHand: {type: 'selector', default: '#left-hand'},
    // If not using the [`vartiste-user-root`](#vartiste-user-root), this
    // selector should indicate the element which corresponds to the right handed
    // controller.
    rightHand: {type: 'selector', default: '#right-hand'},

    // If not using the [`vartiste-user-root`](#vartiste-user-root), this
    // selector should indicate the element which corresponds to the hand offset
    handOffset: {type: 'selector', default: '#hand-offset'},
    // If not using the [`vartiste-user-root`](#vartiste-user-root), this
    // selector should indicate the element which corresponds to the hand root
    handRoot: {type: 'selector', default: '#hand-root'},

    // Delay in milliseconds after entering an XR Session before the forward
    // orientation is guessed from the controllers current orientations
    orientationResetDelay: {default: 3000},

    // If true, adds a little button in the bottom right corner of the scene,
    // next to the Enter VR and Enter AR button.
    addUseControllerButton: {default: false},
  },
  init() {
    if (this.data.addUseControllerButton && navigator.xr)
    {
      var vrButton;
      var wrapper;

      // Create elements.
      wrapper = document.createElement('div');
      wrapper.classList.add('a-enter-vr');
      wrapper.setAttribute('aframe-injected', '');
      vrButton = document.createElement('button');
      vrButton.className = 'a-enter-vr-button';
      vrButton.setAttribute('title',
        'Use VR Controllers while still rendering to desktop monitor');
      vrButton.setAttribute('aframe-injected', '');
      // Insert elements.
      wrapper.appendChild(vrButton);
      vrButton.addEventListener('click', (evt) => {
        this.enterSession();
        evt.stopPropagation();
      });

      wrapper.style.right = "160px";
      vrButton.style.background = `url(${ENTER_CONROLLER_SVG})`;

      this.el.sceneEl.append(wrapper)
    }
  },

  // Starts a new WebXR session in order to retrieve the controller poses.
  // Although the session will take over the attached VR display, nothing will
  // be rendered to it. (This normally can result in the browser displaying its
  // own error message in the HMD.)
  enterSession() {
    this.updateProperties()
    this.controllerEls = document.querySelectorAll('*[webxr-motion-controller]');

    let glCanvas = document.createElement("canvas");
    let gl = glCanvas.getContext("webgl", { xrCompatible: true });
    this.onAnimationFrame = this.onAnimationFrame.bind(this)

    navigator.xr.requestSession("immersive-vr", this.el.systems['webxr'].sessionConfiguration)
    .then((xrSession) => {
      console.log("Sess", xrSession);
      this.xrSession = xrSession
      gl.makeXRCompatible().then(() => {
        // The content that will be shown on the device is defined by the session's
        // baseLayer.
        xrSession.updateRenderState({ baseLayer: new XRWebGLLayer(xrSession, gl) });
      });
        xrSession.requestReferenceSpace("local").then((xrReferenceSpace) => {
          console.log("space", XRReferenceSpace);
          xrSession.requestAnimationFrame((time, xrFrame) => {
            this.firstFrame(xrFrame)
          });
        });
      });
  },
  firstFrame(xrFrame) {
    // Set viewer pose and reset

    // Set controllers
    this.el.xrSession = this.xrSession
    this.el.systems['webxr-input-profiles'].updateReferenceSpace()
    // this.resetHandRootPosition()
    this.xrSession.requestAnimationFrame(this.onAnimationFrame)

    window.setTimeout(() => this.resetHandRootPosition(), 3000)
  },
  // Causes the current controller positions to be interpreted as a neutral
  // forward pose, and reorients the hand offsets so that they match up with the
  // desktop display.
  resetHandRootPosition() {
    console.info("XR Controller resetting hand root position")

    let root = this.data.handRoot.object3D

    let leftHand = this.data.leftHand.object3D
    let rightHand = this.data.rightHand.object3D

    let avgMat = Util.interpTransformMatrices(0.5, leftHand.matrix, rightHand.matrix);
    // avgMat.invert();
    // Util.applyMatrix(avgMat, root)

    let avgPos = new THREE.Vector3();
    avgPos.copy(leftHand.position);
    avgPos.lerp(rightHand.position, 0.5);
    root.position.copy(avgPos);
    root.position.multiplyScalar(-1);

    let q = new THREE.Quaternion();
    q.copy(leftHand.quaternion)
    q.slerp(rightHand.quaternion, 0.5)


    let fwdTmp = new THREE.Vector3();
    fwdTmp.set(0, 0, 1).applyQuaternion(q);
    let spherical = new THREE.Spherical();
    spherical.setFromCartesianCoords(fwdTmp.x, fwdTmp.y, fwdTmp.z);
    console.log("Spehrical", spherical)
    // root.rotation.set(0, spherical.theta, 0)
    //
    this.data.handOffset.object3D.position.z = -0.3
    this.data.handOffset.object3D.rotation.y = - spherical.theta;

    // let positioner = new THREE.Object3D();
    // document.querySelector('#camera').object3D.add(positioner)
    // positioner.position.set(0, -0.3, -0.3)
    //
    // Util.positionObject3DAtTarget(document.querySelector('#hand-root').object3D, positioner)
    // positioner.parent.remove(positioner)
  },
  onAnimationFrame(time, frame) {
    this.el.sceneEl.frame = frame
    this.controllerEls.forEach(el => el.components['webxr-motion-controller'].updatePose())
    this.xrSession.requestAnimationFrame(this.onAnimationFrame)
  }
})
