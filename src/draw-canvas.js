import {Layer} from './layer.js'

AFRAME.registerComponent('draw-canvas', {
  schema: {
    canvas: {type: 'selector'},
    compositor: {type: 'selector'},
    mirrorX: {type: 'bool', default: false},
    mirrorY: {type: 'bool', default: false}
  },

  init() {
    // this.brush = new ProceduralBrush();
    let paintSystem = this.el.sceneEl.systems['paint-system']
    this.brush = paintSystem.brush

    this.sampleCanvas = document.createElement('canvas')
    this.sampleCanvas.width = this.brush.width
    this.sampleCanvas.height = this.brush.height
    document.body.append(this.sampleCanvas)

    this.transform = Layer.EmptyTransform()

    this.el.sceneEl.addEventListener('brushchanged', (e) => {
      this.brush = e.detail.brush
    })
  },

  uvToPoint(uv, canvas = null) {
    let {width, height} = canvas || this.data.canvas
    let {translation, scale} = this.transform
    let {width: uvWidth, height: uvHeight} = this.data.compositor

    let x = uvWidth * uv.x - (translation.x - width / 2 * scale.x + width / 2)
    let y = uvHeight * (1 - uv.y) - (translation.y - height / 2 * scale.y + height / 2)

    x = x / scale.x
    y = y / scale.y

    return {x,y}
  },

  drawUV(uv, {pressure = 1.0, canvas = null, rotation = 0.0}) {
    if (canvas === null) canvas = this.data.canvas
    let ctx = canvas.getContext('2d');
    let {width, height} = canvas

    let {x,y} = this.uvToPoint(uv, canvas)

    ctx.globalAlpha = pressure

    this.brush.drawTo(ctx,  x, y, {rotation})
    if (this.data.mirrorX) {
        this.brush.drawTo(ctx, x + width, y, {rotation})
        this.brush.drawTo(ctx, x - width, y, {rotation})
    }
    if (this.data.mirrorY) {
      this.brush.drawTo(ctx, x, y + height)
      this.brush.drawTo(ctx, x, y - height)
    }
    ctx.globalAlpha = 1.0
  },

  drawOutlineUV(ctx, uv, {canvas = null} = {}) {
    if (canvas === null) canvas = this.data.canvas
    let {width, height} = canvas
    let {x,y} = this.uvToPoint(uv, canvas)
    this.brush.drawOutline(ctx, x, y)

    if (this.data.mirrorX) {
      this.brush.drawOutline(ctx, x + width, y)
      this.brush.drawOutline(ctx, x - width, y)
    }
    if (this.data.mirrorX)
    {
      this.brush.drawOutline(ctx, x, y + height)
      this.brush.drawOutline(ctx, x, y - height)
    }
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

    let {x,y} = this.uvToPoint(uv)
    ctx.drawImage(canvas,
      x - width / 2,
      y - height / 2,
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
  },

  eraseUV(uv, {pressure = 1.0, canvas = null} = {}) {
    console.log("Erasing")
    if (canvas == null) canvas = this.data.canvas
    let ctx = canvas.getContext('2d');
    let {width, height} = canvas

    ctx.save()

    ctx.globalAlpha = pressure

    let {x,y} = this.uvToPoint(uv, canvas)

    ctx.globalCompositeOperation = 'destination-out'

    this.brush.drawTo(ctx,  x, y)
    if (this.data.mirrorX) {
        this.brush.drawTo(ctx, x + width, y)
        this.brush.drawTo(ctx, x - width, y)
    }
    if (this.data.mirrorY) {
      this.brush.drawTo(ctx, x, y + height)
      this.brush.drawTo(ctx, x, y - height)
    }

    ctx.restore()
  },
});
