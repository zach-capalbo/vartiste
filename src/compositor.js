AFRAME.registerComponent('compositor', {
  schema: {canvas: {type: 'selector'}},

  init() {
    this.layers = [document.getElementById('layer1')]
    this.width = this.data.canvas.width
    this.height = this.data.canvas.height

    this.overlayCanvas = document.createElement("canvas")
    let overlayCanvas = document.createElement("canvas")
    overlayCanvas.width = this.width
    overlayCanvas.height = this.height
    document.body.append(overlayCanvas)
    this.overlayCanvas = overlayCanvas;
  },

  tick() {
    let ctx = this.data.canvas.getContext('2d')
    ctx.fillStyle = "#FFFFFF"
    ctx.fillRect(0,0, this.width, this.height)

    const width = this.width
    const height = this.height

    for (let layer of this.layers) {
      ctx.drawImage(layer, 0, 0)
    }

    ctx.save()

    let overlayCtx = this.overlayCanvas.getContext('2d')
    overlayCtx.clearRect(0, 0, width, height)

    for (let hand of ['right-hand', 'left-hand'])
    {
      let intersection = document.getElementById(hand).components.raycaster.getIntersection(this.el)

      if (!intersection) continue

      let x = width * intersection.uv.x
      let y = height * (1 - intersection.uv.y)
      this.el.components['draw-canvas'].brush.drawOutline(overlayCtx, x, y)
    }

    ctx.globalCompositeOperation = 'difference'
    ctx.drawImage(this.overlayCanvas, 0, 0)
    ctx.restore()
  }
})
