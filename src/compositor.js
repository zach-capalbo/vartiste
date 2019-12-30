import {Layer} from "./layer.js"

AFRAME.registerComponent('compositor', {
  schema: {canvas: {type: 'selector'}},

  init() {
    this.width = this.data.canvas.width
    this.height = this.data.canvas.height

    this.layers = [new Layer(this.width, this.height), new Layer(this.width, this.height)]

    let bgCtx = this.layers[0].canvas.getContext('2d')
    bgCtx.fillStyle = "#FFF"
    bgCtx.fillRect(0,0,this.width,this.height)


    let overlayCanvas = document.createElement("canvas")
    overlayCanvas.width = this.width
    overlayCanvas.height = this.height
    document.body.append(overlayCanvas)
    this.overlayCanvas = overlayCanvas;

    this.el.setAttribute("draw-canvas", {canvas: this.layers[0].canvas})
    // this.el.components['draw-canvas'].data.canvas = this.layers[0].canvas
  },

  tick() {
    let ctx = this.data.canvas.getContext('2d')
    // ctx.fillStyle = "#FFFFFF"
    ctx.clearRect(0,0, this.width, this.height)

    const width = this.width
    const height = this.height

    for (let layer of this.layers) {
      if (layer.visible)
      {
        layer.draw(ctx)
      }
    }

    ctx.save()

    let overlayCtx = this.overlayCanvas.getContext('2d')
    overlayCtx.clearRect(0, 0, width, height)

    for (let hand of ['right-hand', 'left-hand'])
    {
      let intersection = document.getElementById(hand).components.raycaster.getIntersection(this.el)

      if (!intersection) continue

      // let x = width * intersection.uv.x
      // let y = height * (1 - intersection.uv.y)
      // this.el.components['draw-canvas'].brush.drawOutline(overlayCtx, x, y)
      this.el.components['draw-canvas'].drawOutlineUV(overlayCtx, intersection.uv)
    }

    ctx.globalCompositeOperation = 'difference'
    ctx.drawImage(this.overlayCanvas, 0, 0)
    ctx.restore()
  }
})
