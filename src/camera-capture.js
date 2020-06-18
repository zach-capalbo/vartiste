AFRAME.registerSystem('camera-capture', {
  getTempCanvas() {
    let {width, height} = Compositor.component;

    if (this.tempCanvas) {
      if (this.tempCanvas.width !== width || this.tempCanvas.height !== height)
      {
        this.tempCanvas.width = width
        this.tempCanvas.height = height
      }
      return this.tempCanvas
    }

    this.tempCanvas = document.createElement('canvas')
    this.tempCanvas.width = width
    this.tempCanvas.height = height
    return this.tempCanvas
  },
  captureToCanvas(camera, canvas) {
    if (!canvas) canvas = this.getTempCanvas()
    this.el.sceneEl.renderer.render(this.el.sceneEl.object3D, camera);

    canvas.getContext('2d').drawImage(this.el.sceneEl.canvas, 0, 0, canvas.width, canvas.height)
    return canvas
  }
})
