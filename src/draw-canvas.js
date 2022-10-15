import {Layer} from './layer.js'
import {Undo} from './undo.js'
import {Pool} from './pool.js'
import {Util} from './util.js'

// Allows painting to a canvas with a [`hand-draw-tool`](#hand-draw-tool). See
// the VARTISTE toolkit demo for example usage
AFRAME.registerComponent('draw-canvas', {
  schema: {
    // Target canvas for painting
    canvas: {type: 'selector'},

    // For VARTISTE use
    compositor: {type: 'selector'},

    emitDrawEvents: {default: false},
  },
  emits: {
    drawing: {x: 0.0, y: 0.0, uv: null},
  },
  init() {
    Pool.init(this)
    Util.emitsEvents(this)
    // this.brush = new ProceduralBrush();
    let paintSystem = this.el.sceneEl.systems['paint-system']
    this.brush = paintSystem.brush

    if (!this.el.hasAttribute('action-tooltips'))
    {
      this.el.setAttribute('action-tooltips__right-hand', 'trigger: Draw; updown: Scale Brush; a: Erase; b: Pick color')
      this.el.setAttribute('action-tooltips__left-hand', 'trigger: Draw; updown: Scale Brush;')
      this.el.setAttribute('action-tooltips__mouse', 'trigger: Draw')
    }

    this.sampleCanvas = document.createElement('canvas')
    this.sampleCanvas.width = this.brush.width
    this.sampleCanvas.height = this.brush.height
    document.body.append(this.sampleCanvas)

    this.transform = Layer.EmptyTransform()

    this.el.sceneEl.addEventListener('brushchanged', (e) => {
      this.brush = e.detail.brush
    })

    Util.whenLoaded([this.el, this.el.sceneEl], () => {
      this.brush = paintSystem.brush
    })

    this.el.addEventListener('framechanged', (e) => {
      // this.currentFrame = e.details.frame
      delete this.imageData
    })

    this.wrappedDraw = this.wrappedDraw.bind(this)
  },
  update(oldData) {
    if (this.data.canvas !== oldData.canvas && this.data.canvas) {
      this.ctx = this.data.canvas.getContext('2d')
    }
  },
  uvToPoint(uv, canvas = null, {useTransform = true} = {}) {
    let {width, height} = canvas || this.data.canvas
    let {translation, scale} = this.transform

    let {width: uvWidth, height: uvHeight} = this.data.compositor || canvas || this.data.canvas

    if (!uv) return {x: 0, y: 0}

    let yy = (1 + uv.y % 1) % 1
    let xx = (1 + uv.x % 1) % 1
    if (!this.data.compositor || Compositor.component.data.flipY) yy = 1.0 - yy

    if (!useTransform)
    {
      return {x: uvWidth * xx, y: uvHeight * yy}
    }

    let x = uvWidth * xx - (translation.x - width / 2 * scale.x + width / 2)
    let y = uvHeight * yy - (translation.y - height / 2 * scale.y + height / 2)

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

  wrappedDraw(x,y, ctx, brush, drawOptions) {
    brush.drawTo(ctx,  x, y, drawOptions)
  },

  drawUV(uv, {pressure = 1.0, canvas = null, ctx = null, rotation = 0.0, sourceEl = undefined, distance=0.0, scale=1.0, lastParams = undefined, brush = undefined}) {
    if (canvas === null) canvas = this.data.canvas

    if (canvas.touch) canvas.touch()

    if (!brush) brush = this.brush

    if (!ctx) ctx = (this.data.canvas === canvas ? this.ctx : canvas.getContext('2d'));
    let {width, height} = canvas

    let {x,y} = this.uvToPoint(uv, canvas)


    if (this.data.emitDrawEvents)
    {
      this.emitDetails.drawing.x = x
      this.emitDetails.drawing.y = y
      this.emitDetails.drawing.uv = uv
      this.emitDetails.drawing.drawTime = drawTime
      this.el.emit('drawing', this.emitDetails.drawing)
    }

    let imageData

    let highQuality = true;

    let hqBlending = brush.hqBlending && brush.opacity < 0.4

    hqBlending = hqBlending || this.brush.hqBlending === 'always'

    let firstDraw = !this.wasDrawing
    this.wasDrawing = true

    let drawTime = 0

    if (firstDraw)
    {
      this.startDrawTime = this.el.sceneEl.time
    }
    else
    {
      drawTime = this.el.sceneEl.time - this.startDrawTime
    }

    if (firstDraw && sourceEl)
    {
      this.el.emit('startcanvasdrawing')
      Undo.pushCanvas(canvas)
      sourceEl.addEventListener('enddrawing', (e) => {
        this.wasDrawing = false
        if (brush.endDrawing) {
          brush.endDrawing(ctx)
        }
        delete this.imageData
        this.el.emit('endcanvasdrawing')
      }, {once: true})
      this.undoFrame = this.currentFrame
      let recentColors = document.getElementById('recent-colors')
      if (recentColors) {
        recentColors.components['palette'].addToPalette()
      }
    }
    else if (sourceEl && this.currentFrame !== this.undoFrame)
    {
      Undo.pushCanvas(canvas)
      this.undoFrame = this.currentFrame
    }

    if (brush.dragRotate || brush.minMovement)
    {
      let pixelThresholdHeight = 4 / height
      let pixelThresholdWidth = 4 / width
      if (brush.minMovement) {
        pixelThresholdWidth = brush.minMovement
        pixelThresholdHeight = brush.minMovement
      }
      if (!lastParams) return
      let oldPoint = this.uvToPoint(lastParams.uv, canvas)
      if (Math.abs(y - oldPoint.y) < pixelThresholdHeight && Math.abs(x - oldPoint.x) < pixelThresholdWidth) return
      rotation = Math.atan2(y - oldPoint.y, x - oldPoint.x)
      lastParams.rotation = rotation
    }

    try {
      if (firstDraw && brush.startDrawing)
      {
        let drawOptions = {rotation, pressure, distance, imageData, scale, hqBlending, drawTime}
        brush.startDrawing(ctx, x, y, drawOptions)
      }

      if (brush.connected && highQuality && lastParams) {
        let oldPoint = this.uvToPoint(lastParams.uv, canvas)
        let distance = Math.sqrt( (oldPoint.x - x) * (oldPoint.x - x) + (oldPoint.y - y) * (oldPoint.y - y) )
        let numPoints = Math.max(Math.floor(distance ), 1)
        let lerpedOpts = {hqBlending}

        if (numPoints > 100) numPoints = -1

        for (let i = 0; i < numPoints; i++)
        {
          let lerp = i / numPoints

          let xx = THREE.Math.lerp(oldPoint.x, x, lerp)
          let yy = THREE.Math.lerp(oldPoint.y, y, lerp)
          lerpedOpts.rotation = THREE.Math.lerp(lastParams.rotation, rotation, lerp)
          lerpedOpts.pressure = THREE.Math.lerp(lastParams.pressure, pressure, lerp)
          lerpedOpts.distance = THREE.Math.lerp(lastParams.distance, distance, lerp)
          lerpedOpts.scale = THREE.Math.lerp(lastParams.scale, scale, lerp)
          lerpedOpts.drawTime = THREE.Math.lerp(lastParams.drawTime, drawTime, lerp)

          this.wrap(xx,yy,width,height, this.wrappedDraw, ctx, brush, lerpedOpts)
        }
      }
      else
      {
        let drawOptions = {rotation, pressure, distance, imageData, scale, hqBlending, drawTime}
        this.wrap(x,y,width,height, this.wrappedDraw, ctx, brush, drawOptions)
      }
    }
    catch (e)
    {
      console.error("Drawing error", e)
    }
    ctx.globalAlpha = 1.0
  },

  drawOutlineUV(ctx, uv, {canvas = null, rotation = 0.0, brush} = {}) {
    if (canvas === null) canvas = this.data.canvas
    let {width, height} = canvas
    let {x,y} = this.uvToPoint(uv, canvas)
    if (!brush) brush = this.brush
    brush.drawOutline(ctx, x, y, {rotation})

    let {wrapX, wrapY} = this.el.sceneEl.systems['paint-system'].data
    if (wrapX) {
      brush.drawOutline(ctx, x + width, y)
      brush.drawOutline(ctx, x - width, y)
    }
    if (wrapY)
    {
      brush.drawOutline(ctx, x, y + height)
      brush.drawOutline(ctx, x, y - height)
    }
    if (wrapY && wrapX) {
      brush.drawOutline(ctx, x + width, y + height)
      brush.drawOutline(ctx, x - width, y - height)
      brush.drawOutline(ctx, x + width, y - height)
      brush.drawOutline(ctx, x - width, y + height)
    }
  },

  pickColorUV(uv, {canvas = null} = {}) {
    let useTransform = true

    if (canvas === null && !this.data.compositor) {
      canvas = this.data.canvas
    }

    if (canvas === null) {
      let compositor = document.getElementById('canvas-view').components.compositor
      if (compositor.activeLayer.mode.endsWith("Map"))
      {
        canvas = compositor.activeLayer.frame(compositor.currentFrame)
      }
      else if (compositor.data.usePreOverlayCanvas)
      {
        canvas = compositor.preOverlayCanvas
        useTransform = false
      }
      else
      {
        canvas = compositor.compositeCanvas
        useTransform = false
      }
    }

    let sampleCanvas = this.sampleCanvas
    let ctx = sampleCanvas.getContext('2d')
    let width = Math.max(Math.round(this.brush.width), 1)
    let height = Math.max(Math.round(this.brush.height), 1)
    // console.log("Using canvas", this.brush, canvas, width, height)

    if (typeof width === 'undefined' || !isFinite(width)) return
    if (typeof height === 'undefined' || !isFinite(height)) return

    this.sampleCanvas.width = width
    this.sampleCanvas.height = height
    ctx.clearRect(0, 0, sampleCanvas.width, sampleCanvas.height)

    let {x,y} = this.uvToPoint(uv, undefined, {useTransform})
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

    if (avg.alpha > 0.00001)
    {
      avg.r /= avg.alpha
      avg.g /= avg.alpha
      avg.b /= avg.alpha
    }
    else
    {
      avg.r = 0
      avg.g = 0
      avg.b = 0
    }

    if (isNaN(avg.r) || isNaN(avg.g) || isNaN(avg.b))
    {
      throw new Error("Color sampling error. NAN", uv, x,y, avg, canvas, sampleCanvas, width, height)
    }

    // console.log("Picked", avg)

    // if (!this.el.sceneEl.getAttribute('renderer').colorManagement)
    {

      return `rgba(${Math.round(avg.r * 255)}, ${Math.round(avg.g * 255)}, ${Math.round(avg.b * 255)}, 1.0)`
    }

    this.threeColor = this.pool("threeColor", THREE.Color)
    this.threeColor.setRGB(avg.r, avg.g, avg.b)
    // this.threeColor.convertSRGBToLinear()

    return this.threeColor.getStyle()
  },

  eraseUV(uv, rawParams = {}) {
    let {pressure = 1.0, canvas = null, rotation=0.0, scale=1.0, sourceEl = undefined, brush = undefined} = rawParams
    if (canvas == null) canvas = this.data.canvas
    if (canvas.touch) canvas.touch()
    if (!brush) brush = this.brush
    if (!this.wasErasing && sourceEl)
    {
      console.log("Pushing erase canvas")
      Undo.pushCanvas(canvas)
      const eraseListener = (e) => {
        if (e.detail === 'erasing')
        {
          console.log("Clearing erase undo canvas")
          this.wasErasing = false
          sourceEl.removeEventListener('stateremoved', eraseListener)
          sourceEl.removeEventListener('fakeclearstate', eraseListener)
        }
      }
      sourceEl.addEventListener('stateremoved', eraseListener)
      sourceEl.addEventListener('fakeclearstate', eraseListener)
      this.wasErasing = true
    }

    let ctx = canvas.getContext('2d');
    let {width, height} = canvas

    ctx.save()

    // ctx.globalAlpha = pressure

    let {x,y} = this.uvToPoint(uv, canvas)

    ctx.globalCompositeOperation = 'destination-out'

    this.wrap(x, y, width, height, this.wrappedDraw, ctx, brush, Object.assign({eraser: true}, rawParams))
    ctx.restore()
  },
});
