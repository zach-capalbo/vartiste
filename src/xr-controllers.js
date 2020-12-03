AFRAME.registerSystem('xr-controllers-only', {
  init() {
    this.placeholder = document.createElement('a-box')
  },
  enterSession() {
    let glCanvas = document.createElement("canvas");
    let gl = glCanvas.getContext("webgl", { xrCompatible: true });

    navigator.xr.requestSession("immersive-vr").then((xrSession) => {
      console.log("Sess", xrSession);
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
    this.el.append(this.placeholder)
    this.placeholder.object3D.matrix.elements
  }
})
