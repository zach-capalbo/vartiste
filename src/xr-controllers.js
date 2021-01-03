import {Util} from './util.js'
AFRAME.registerSystem('xr-controllers-only', {
  init() {
    // this.placeholder = document.createElement('a-box')
  },
  enterSession() {
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
  resetHandRootPosition() {
    console.info("XR Controller resetting hand root position")
    // document.querySelector('#hand-root').object3D.position.set(0.4, -0.8, 0.4)
    // document.querySelector('#hand-root').object3D.rotation.set(0, Math.PI, 0)
    let root = document.querySelector('#hand-root').object3D

    let leftHand = document.querySelector('#left-hand').object3D
    let rightHand = document.querySelector('#right-hand').object3D

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
    document.querySelector('#hand-offset').object3D.position.z = -0.3
    document.querySelector('#hand-offset').object3D.rotation.y = - spherical.theta;

    // let positioner = new THREE.Object3D();
    // document.querySelector('#camera').object3D.add(positioner)
    // positioner.position.set(0, -0.3, -0.3)
    //
    // Util.positionObject3DAtTarget(document.querySelector('#hand-root').object3D, positioner)
    // positioner.parent.remove(positioner)
  },
  onAnimationFrame(time, frame) {
    this.el.sceneEl.frame = frame
    document.querySelectorAll('*[webxr-motion-controller]').forEach(el => el.components['webxr-motion-controller'].updatePose())
    this.xrSession.requestAnimationFrame(this.onAnimationFrame)
  }
})
