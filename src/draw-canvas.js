import {Layer} from './layer.js'
import {Undo} from './undo.js'

AFRAME.registerComponent('draw-canvas', {
  schema: {
    canvas: {type: 'selector'},
    compositor: {type: 'selector'}
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

    this.el.addEventListener('framechanged', (e) => {
      // this.currentFrame = e.details.frame
      delete this.imageData
    })

    this.wrappedDraw = this.wrappedDraw.bind(this)
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

  wrap(x, y, width, height, f, ...opts){
    let {wrapX, wrapY} = this.el.sceneEl.systems['paint-system'].data
    f(x, y, ...opts)

    if (wrapX) {
        f(x + width, y, ...opts)
        f(x - width, y, ...opts)
    }
    if (wrapY) {
      f(x, y + height, ...opts)
      f(x, y - height, ...opts)
    }
    if (wrapY && wrapX) {
      f(x + width, y + height, ...opts)
      f(x - width, y - height, ...opts)
      f(x + width, y - height, ...opts)
      f(x - width, y + height, ...opts)
    }
  },

  wrappedDraw(x,y, ctx, drawOptions) {
    this.brush.drawTo(ctx,  x, y, drawOptions)
  },

  drawUV(uv, {pressure = 1.0, canvas = null, rotation = 0.0, sourceEl = undefined, distance=0.0, scale=1.0, lastParams = undefined}) {
    if (canvas === null) canvas = this.data.canvas

    if (canvas.touch) canvas.touch()

    let ctx = canvas.getContext('2d');
    let {width, height} = canvas

    let {x,y} = this.uvToPoint(uv, canvas)

    let imageData

    let highQuality = this.el.sceneEl.systems['settings-system'].quality > 0.75

    let hqBlending = this.brush.hqBlending && highQuality //&& this.brush.opacity < 0.3

    if (hqBlending)
    {
      // imageData = this.imageData || ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height)
      // this.imageData = imageData
      this.brush.hqBlender.setInputCanvas(ctx.canvas)
      this.brush.hqBlender.update()
    }

    if (!this.wasDrawing && sourceEl)
    {
      Undo.pushCanvas(canvas)
      sourceEl.addEventListener('enddrawing', (e) => {
        this.wasDrawing = false
        delete this.imageData
      }, {once: true})
      this.wasDrawing = true
      this.undoFrame = this.currentFrame
    }
    else if (sourceEl && this.currentFrame !== this.undoFrame)
    {
      Undo.pushCanvas(canvas)
      this.undoFrame = this.currentFrame
    }

    try {
      if (this.brush.connected && highQuality && lastParams) {
        let oldPoint = this.uvToPoint(lastParams.uv, canvas)
        let distance = Math.sqrt( (oldPoint.x - x) * (oldPoint.x - x) + (oldPoint.y - y) * (oldPoint.y - y) )
        let numPoints = Math.max(Math.floor(distance ), 1)
        let lerpedOpts = {imageData}

        for (let i = 0; i < numPoints; i++)
        {
          let lerp = i / numPoints

          let xx = THREE.Math.lerp(oldPoint.x, x, lerp)
          let yy = THREE.Math.lerp(oldPoint.y, y, lerp)
          lerpedOpts.rotation = THREE.Math.lerp(lastParams.rotation, rotation, lerp)
          lerpedOpts.pressure = THREE.Math.lerp(lastParams.pressure, pressure, lerp)
          lerpedOpts.distance = THREE.Math.lerp(lastParams.distance, distance, lerp)
          lerpedOpts.scale = THREE.Math.lerp(lastParams.scale, scale, lerp)

          this.wrap(xx,yy,width,height, this.wrappedDraw, ctx, lerpedOpts)
        }
      }
      else
      {
        let drawOptions = {rotation, pressure, distance, imageData, scale}
        this.wrap(x,y,width,height, this.wrappedDraw, ctx, drawOptions)
      }

      // if (hqBlending)
      // {
      //   ctx.putImageData(imageData, 0, 0)
      // }
    }
    catch (e)
    {
      console.error("Drawing error", e)
    }
    ctx.globalAlpha = 1.0
  },

  drawOutlineUV(ctx, uv, {canvas = null, rotation = 0.0} = {}) {
    if (canvas === null) canvas = this.data.canvas
    let {width, height} = canvas
    let {x,y} = this.uvToPoint(uv, canvas)
    this.brush.drawOutline(ctx, x, y, {rotation})

    let {wrapX, wrapY} = this.el.sceneEl.systems['paint-system'].data
    if (wrapX) {
      this.brush.drawOutline(ctx, x + width, y)
      this.brush.drawOutline(ctx, x - width, y)
    }
    if (wrapY)
    {
      this.brush.drawOutline(ctx, x, y + height)
      this.brush.drawOutline(ctx, x, y - height)
    }
    if (wrapY && wrapX) {
      this.brush.drawOutline(ctx, x + width, y + height)
      this.brush.drawOutline(ctx, x - width, y - height)
      this.brush.drawOutline(ctx, x + width, y - height)
      this.brush.drawOutline(ctx, x - width, y + height)
    }
  },

  pickColorUV(uv, {canvas = null} = {}) {
    if (canvas === null) {
      let compositor = document.getElementById('canvas-view').components.compositor
      if (compositor.activeLayer.mode.endsWith("Map"))
      {
        canvas = compositor.activeLayer.frame(compositor.currentFrame)
      }
      else if (compositor.data.usePreOverlayCanvas)
      {
        canvas = compositor.preOverlayCanvas
      }
      else
      {
        canvas = compositor.compositeCanvas
      }
    }
    let sampleCanvas = this.sampleCanvas
    let ctx = sampleCanvas.getContext('2d')
    let width = Math.round(this.brush.width)
    let height = Math.round(this.brush.height)

    if (typeof width === 'undefined') return
    if (typeof height === 'undefined') return

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

  eraseUV(uv, rawParams = {}) {
    let {pressure = 1.0, canvas = null, rotation=0.0, scale=1.0, sourceEl = undefined} = rawParams
    if (canvas == null) canvas = this.data.canvas
    if (canvas.touch) canvas.touch()
    if (!this.wasErasing && sourceEl)
    {
      Undo.pushCanvas(canvas)
      const eraseListener = (e) => {
        if (e.detail === 'erasing')
        {
          this.wasErasing = false
        }
        sourceEl.removeEventListener('stateremoved', eraseListener)
      }
      sourceEl.addEventListener('stateremoved', eraseListener)
      this.wasErasing = true
    }

    let ctx = canvas.getContext('2d');
    let {width, height} = canvas

    ctx.save()

    // ctx.globalAlpha = pressure

    let {x,y} = this.uvToPoint(uv, canvas)

    ctx.globalCompositeOperation = 'destination-out'

    this.wrap(x, y, width, height, this.wrappedDraw, ctx, Object.assign({eraser: true}, rawParams))
    ctx.restore()
  },
});
