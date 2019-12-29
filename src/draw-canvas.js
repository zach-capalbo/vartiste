import {ProceduralBrush} from './brush.js'

AFRAME.registerComponent('draw-canvas', {
  schema: {canvas: {type: 'selector'}},

  init() {
    this.brush = new ProceduralBrush(this.data.canvas.getContext('2d'));
    this.brush.changeColor(this.el.sceneEl.systems['paint-system'].data.color)

    this.sampleCanvas = document.createElement('canvas')
    this.sampleCanvas.width = this.brush.width
    this.sampleCanvas.height = this.brush.height
    document.body.append(this.sampleCanvas)

    this.el.sceneEl.addEventListener('colorchanged', (e) => {
      this.brush.changeColor(e.detail.color)
    })

    this.el.sceneEl.addEventListener('brushscalechanged', (e) => {
      this.brush.changeScale(e.detail.brushScale)
    })
  },

  drawUV(uv, {pressure = 1.0, canvas = null}) {
    if (canvas == null) canvas = this.data.canvas
    let ctx = canvas.getContext('2d');

    ctx.globalAlpha = pressure
    this.brush.drawTo(ctx,  canvas.width * uv.x, canvas.height * (1 - uv.y))
    ctx.globalAlpha = 1.0
  },

  pickColorUV(uv) {
    let canvas = this.data.canvas
    let sampleCanvas = this.sampleCanvas
    let ctx = sampleCanvas.getContext('2d')
    let width = Math.round(this.brush.width)
    let height = Math.round(this.brush.height)
    this.sampleCanvas.width = width
    this.sampleCanvas.height = height
    ctx.clearRect(0, 0, sampleCanvas.width, sampleCanvas.height)
    ctx.drawImage(canvas,
      canvas.width * uv.x - width / 2,
      canvas.height * (1 - uv.y) - height / 2,
      width, height,
      0, 0,
      width, height
    )

    ctx.save()
    ctx.globalCompositeOperation = 'destination-in'
    this.brush.drawTo(ctx, width / 2, height / 2)
    ctx.restore()

    let imageData = ctx.getImageData(0, 0, width, height)
    let avg = {r:0.0, g:0.0, b:0.0, alpha: 0}

    for (let j = 0; j < height; ++j)
    {
      for (let i = 0; i < width; ++i)
      {
        // console.log(4*(j * width + i), imageData.data[4*(j * width + i) + 0])
        avg.r += imageData.data[4*(j * width + i) + 0] / 255 * imageData.data[4*(j * width + i) + 3] / 255.0
        avg.g += imageData.data[4*(j * width + i) + 1] / 255 * imageData.data[4*(j * width + i) + 3] / 255.0
        avg.b += imageData.data[4*(j * width + i) + 2] / 255 * imageData.data[4*(j * width + i) + 3] / 255.0
        avg.alpha += imageData.data[4*(j * width + i) + 3] / 255.0
      }
    }

    avg.r /= avg.alpha
    avg.g /= avg.alpha
    avg.b /= avg.alpha

    return `rgba(${Math.round(avg.r * 255)}, ${Math.round(avg.g * 255)}, ${Math.round(avg.b * 255)}, 1.0)`
  }
});
