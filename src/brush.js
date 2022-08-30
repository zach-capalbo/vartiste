import Convolve from "convolve"
import Color from "color"
import {CanvasShaderProcessor, UVStretcher} from './canvas-shader-processor.js'
import {Util} from './util.js'
import {Pool} from './pool.js'
import {MarchingSquaresOpt} from './framework/marching-squares.js'

export class Brush {
  static schema() {
    return {
      baseid: {type: 'string'},
      user: {default: false},
      color: {type: 'color', default: 'black'},
      opacity: {default: 1.0},
      scale: {default: 1.0},
      tooltip: {type: 'string'},
      hidden: {default: false}
    }
  }
  constructor(baseid) {
    this.ignoredAttributes = []
    this.baseid = baseid
    this.storableAttributes = [
      'baseid',
      'color',
      'opacity',
      'scale',
      'user'
    ]
    this.unenumerableAttrs = {}
  }
  unenumerable(attr) {
    this.unenumerableAttrs[attr] = true
  }
  clone() {
    return Object.assign( Object.create( Object.getPrototypeOf(this)), this)
  }
  store() {
    let obj = {}
    for (let a of this.storableAttributes)
    {
      obj[a] = this[a]
    }
    return obj
  }
  static fromStore(obj, brushList) {
    let brush = brushList.find(b => b.baseid === obj.baseid)

    if (!brush)
    {
      throw new Error("Can't find brush for serialized brush", obj)
    }

    brush = Object.assign(brush.clone(), obj)
    brush.changeScale(obj.scale)
    brush.changeColor(obj.color)
    brush.changeOpacity(obj.opacity)

    return brush
  }
  fullStore() {
    let obj = {
      _class: this.constructor.name
    }
    let schema = this.constructor.schema()
    for (let a in schema)
    {
      if (a in this) {
        if ('store' in schema[a])
        {
          obj[a] = schema[a].store.call(this, this[a])
        }
        else
        {
          obj[a] = this[a]
        }
      }
    }
    return obj
  }

  static fullRestore(_obj) {
    let constructor = constructors[_obj._class]
    let obj = {}
    let schema = constructor.schema()
    for (let a in schema)
    {
      if (a in _obj)
      {
        if ('restore' in schema[a])
        {
          obj[a] = schema[a].restore(_obj[a])
        }
        else
        {
          obj[a] = _obj[a]
        }
      }
      else
      {
        obj[a] = schema[a].default
      }
    }
    let brush = new constructor(obj)
    return brush
  }
}

window.Brush = Brush

export class ProceduralBrush extends Brush {
  static schema() {
    return Object.assign({
      width: {default: 20},
      height: {default: 20},
      baseWidth: {default: 20},
      baseHeight: {default: 20},
      distanceBased: {default: false},
      maxDistance: {default: 1.5},
      connected: {default: false},
      autoRotate: {default: false},
      dragRotate: {default: false},
      hqBlending: {default: false},
      drawEdges: {default: false},
      invertScale: {default: false},
      opacityScale: {default: 1.0},
      minMovement: {type: 'float', default: undefined},
      mode: {default: 'source-over'},
    }, super.schema())
  }
  constructor(baseid, {
    width=20,
    height=20,
    distanceBased=false,
    maxDistance=1.5,
    connected=false,
    autoRotate=false,
    dragRotate=false,
    hqBlending=false,
    drawEdges=false,
    invertScale=false,
    opacityScale=1.0,
    minMovement=undefined,
    tooltip=undefined,
    user=false,
    hidden=false,
    mode='source-over',
    ...options} = {})
  {
    super(baseid);

    this.baseWidth = width
    this.baseHeight = height
    this.width = width
    this.height = height
    this.scale = 1
    this.opacity = 1.0
    this.options = options
    this.distanceBased=distanceBased
    this.maxDistance=maxDistance
    this.connected=connected
    this.autoRotate = autoRotate
    this.hqBlending = hqBlending
    this.drawEdges = drawEdges
    this.dragRotate = dragRotate
    this.invertScale = invertScale
    this.opacityScale = opacityScale
    this.minMovement = minMovement
    this.tooltip = tooltip
    this.user = user
    this.mode = mode
    this.hidden = hidden

    let overlayCanvas = Util.createCanvas(width, height)
    this.overlayCanvas = overlayCanvas;
    this.unenumerable("overlayCanvas")

    if (this.hqBlending)
    {
      this.hqBlender = new CanvasShaderProcessor({source: require('./shaders/brush/hq-blending.glsl')})
      this.unenumerable("hqBlender")
    }

    this.color3 = new THREE.Color;

    this.unenumerable("color3")
    this.unenumerable("ccolor")
    this.unenumerable("brushdata")

    this.changeColor('#FFF')
  }
  clone() {
    let clone = super.clone()
    clone.overlayCanvas = Util.cloneCanvas(this.overlayCanvas)
    if (clone.hqBlending)
    {
      clone.hqBlender = new CanvasShaderProcessor({source: require('./shaders/brush/hq-blending.glsl')})
    }
    console.log("Returning cloned brush")
    return clone
  }

  changeColor(color) {
    this.color = color
    this.color3.set(this.color)
    this.ccolor = Color(color)

    this.updateBrush()
  }

  changeScale(scale) {
    this.scale = scale

    this.width = this.baseWidth * scale
    this.height = this.baseHeight * scale
    this.overlayCanvas.width = Math.max(this.width, 1)
    this.overlayCanvas.height = Math.max(this.height, 1)

    this.updateBrush()
  }

  changeOpacity(opacity) {
    this.opacity = opacity * this.opacityScale
  }

  createBrush() {
    if (this.invalid) return;
    let ctx = this.overlayCanvas.getContext("2d")

    let width = this.width
    let height = this.height

    ctx.clearRect(0, 0, width, height)

    let {innerRadius = 2} = this.options
    const {outerRadius = width / 2} = this.options

    if (this.options.hardness)
    {
      innerRadius = width / 2 * this.options.hardness
    }

    let x = width / 2
    let y = height / 2

    let color = this.color3
    let gradient = ctx.createRadialGradient(x, y, innerRadius, x, y, outerRadius)
    gradient.addColorStop(0, `rgba(${255 * color.r}, ${255 * color.g}, ${255 * color.b}, 1)`);
    gradient.addColorStop(1, `rgba(${255 * color.r}, ${255 * color.g}, ${255 * color.b}, 0.0)`);

    ctx.fillStyle = gradient
    ctx.fillRect(0,0,width,height)
  }

  updateBrush() {
    if (this.invalid) return;
    this.createBrush()
    let ctx = this.overlayCanvas.getContext("2d")
    let {width, height} = this

    if (width <= 1 || height <= 1) return
    if (ctx.canvas.width <= 1 || ctx.canvas.height <= 1) return

    if (this.hqBlending)
    {
      this.brushData = ctx.getImageData(0, 0, width, height)
    }

    if (!this.previewSrc)
    {
      if (this.overlayCanvas.toDataURL)
      {
        this.previewSrc = this.overlayCanvas.toDataURL()
      }
      else
      {
        this.overlayCanvas.toBlob().then((b) => this.previewSrc = b)
      }
    }

    this.createOutline(this.overlayCanvas)
    this.brushData = ctx.getImageData(0, 0, width, height)

    if (this.hqBlending && Object.keys(this.hqBlender.textures).length > 0)
    {
      this.hqBlender.setCanvasAttribute("u_brush", this.overlayCanvas)
      this.hqBlender.needsUpdate = true
    }
  }

  createOutline(source) {
    if (!this.drawEdges) return
    let {width, height} = source
    this.outlineCanvas = this.outlineCanvas || Util.createCanvas(width, height)

    let outlineCtx = this.outlineCanvas.getContext('2d')
    outlineCtx.drawImage(source, 1, 1, width-2,height-2)

    outlineCtx.globalCompositeOperation = 'source-in'

    outlineCtx.fillStyle = '#fff'
    outlineCtx.fillRect(0,0, width, height)

    const edge_filter = [
                          [-1, -1, -1],
                          [-1, 8.01, -1],
                          [-1, -1, -1]
                        ];


    // const sharp_filter = [
    //   [-1 / 9, -1 / 9, -1 / 9],
    //   [-1 / 9, 2 - 1/ 9, - 1 / 9],
    //   [-1 / 9, -1 / 9, -1 / 9],
    // ]

    const sharp_filter = [
      [0, -1, 0],
      [-1, 5, -1],
      [0, -1, 0],
    ]

    Convolve(edge_filter).canvas(this.outlineCanvas)
    // Convolve(sharp_filter).canvas(this.outlineCanvas)
  }

  carry(carryVal, c) {
    let val = THREE.Math.clamp(this.color3[c] * 255 + carryVal[c], 0, 254.4)
    let f = Math.round(val)
    carryVal[c] = val - f
    return f
  }

  drawTo(ctx, x, y, opts = {}) {
    if (this.invalid) return;
    let {rotation=0, pressure=1.0, distance=0.0, eraser=false, scale=1.0, hqBlending = false} = opts

    if (this.invertScale) {
      scale = 1.1 - scale
      pressure = pressure * pressure
    }

    if (this.hqBlending && hqBlending && !eraser)
    {
      this.hqBlender.drawBrush(this, ctx, x, y, {reupdate: this.hqBlender.needsUpdate, ...opts, scale})
      this.hqBlender.needsUpdate = false
      return
    }

    ctx.save()

    if (!eraser)
    {
      ctx.globalCompositeOperation = this.mode
    }

    if (this.distanceBased)
    {
      ctx.globalAlpha = Math.max(0, (this.maxDistance - distance) / this.maxDistance)
    }
    else
    {
      ctx.globalAlpha = pressure
    }
    ctx.globalAlpha *= this.opacity
    ctx.translate(x,y)

    if (this.distanceBased){
      let scale = ctx.globalAlpha * 2
      ctx.scale(1/scale, 1/scale)
    }

    ctx.scale(scale, scale)
    ctx.rotate(this.autoRotate ? 2*Math.PI*Math.random() : rotation)

    ctx.drawImage(this.overlayCanvas, - this.width / 2, - this.height / 2)
    ctx.restore()
  }

  drawOutline(ctx, x, y, {distance=0, rotation=0} = {})
  {
    if (this.invalid) return;
    const width = this.width
    const height = this.height
    let oldAlpha = ctx.globalAlpha

    if (this.distanceBased)
    {
      ctx.globalAlpha = Math.max(0, (this.maxDistance - distance) / this.maxDistance)
    }

    if (this.drawEdges)
    {
      ctx.save()
      ctx.translate(x,y)
      ctx.rotate(rotation)

      if (this.outlineCanvas && width > 0 && height > 0)
      {
        ctx.drawImage(this.outlineCanvas, -width / 2, - height / 2, width, height)
      }

      ctx.beginPath()
      ctx.strokeStyle = '#FFFFFF'
      ctx.rect(- width / 2,  - height / 2, width, height)
      ctx.stroke()
      ctx.restore()
      return
    }


    ctx.beginPath()
    ctx.arc(x, y, width / 3, 0, 2 * Math.PI, false)
    ctx.strokeStyle = '#FFFFFF'
    ctx.stroke()

  }
}

export class ImageBrush extends ProceduralBrush{
  static schema() {
    return Object.assign({
      textured: {default: false},
      image: {
        type: 'map',
        store: (img) => {
          if (img.src.startsWith('blob:') || img.src.startsWith('http'))
          {
            return Util.cloneCanvas(img).toDataURL()
          }
          return img.src
        },
        restore: (src) => {
          let img = new Image()
          img.src = src;
          return img
        }
      }
    }, super.schema())
  }
  constructor(baseid, name, options = {}) {
    let image;

    if (name === undefined) {
      options = baseid
      baseid = options.baseid
      name = options.name
      image = options.image
    }
    else if (name instanceof Image)
    {
      image = name
      name = baseid
    }
    else if ('width' in options && 'height' in options) {
      image = new Image(options.width, options.height)
    }
    else
    {
      image = new Image()
    }

    try {
      image.decoding = 'sync'
      image.loading = 'eager'
      if (!image.src) {
        let assetSrc = require(`./brushes/${name}.png`)
        if (assetSrc.startsWith("brushes/") && window.VARTISTE_TOOLKIT_URL)
        {
          assetSrc = `${VARTISTE_TOOLKIT_URL}/${assetSrc}`
        }
        image.src = assetSrc
      }
      let width, height;
      if ('width' in options && 'height' in options) {
        width = options.width
        height = options.height
      }
      else
      {
        width = image.width
        height = image.height
      }


      super(baseid, Object.assign({drawEdges: true}, options, {width, height}))

      if (!options.tooltip)
      {
        this.tooltip = Util.titleCase(name.replace(/[\_\-\.]/g, " "))
      }

      this.textured = options.textured
      this.image = image
      this.previewSrc = image
      this.image.decode().then(() => this.updateBrush()).catch(e => {
        console.warn("Couldn't decode brush image", e)
        this.invalid = true
      })
    }
    catch (e)
    {
      console.warn("Couldn't load brush", e)
      super(baseid, {})
      this.invalid = true
    }
  }

  createBrush() {
    if (!this.image) return;
    if (!this.image.complete) return
    if (this.invalid) return;

    let ctx = this.overlayCanvas.getContext("2d")

    const width = this.width
    const height = this.height

    ctx.clearRect(0, 0, width, height)

    ctx.save()

    ctx.drawImage(this.image, 0, 0, width, height)

    ctx.globalCompositeOperation = 'source-in'

    ctx.fillStyle = this.color
    ctx.fillRect(0, 0, width, height)

    if (this.options.textured)
    {
      ctx.globalCompositeOperation = 'multiply'
      ctx.drawImage(this.image, 0, 0, width, height)
    }

    ctx.restore()
  }
}

export class LambdaBrush extends ProceduralBrush {
  constructor(baseid, options={}, lambda) {
    super(baseid, options)
    this.lambda = lambda
    this.previewSrc = undefined
    this.updateBrush()
  }
  createBrush() {
    if (!this.lambda) return
    let ctx = this.overlayCanvas.getContext("2d")

    const width = this.width
    const height = this.height
    ctx.clearRect(0, 0, width, height)
    ctx.fillStyle = this.color
    ctx.strokeStyle = this.color
    this.lambda(ctx, {width, height})

    if (!this.previewSrc)
    {
      this.previewSrc = this.overlayCanvas.toDataURL()
    }
  }
}

export class FillBrush extends Brush {
  constructor(baseid, {mode = "source-over", previewSrc, tooltip = undefined} = {}) {
    super(baseid);
    this.previewSrc = previewSrc || require('./assets/format-color-fill.png')
    this.mode = mode
    this.hqBlending = false
    this.width = 48
    this.height = 48
    this.tooltip = tooltip || `Fill ${mode}`
  }
  changeColor(color) {
    this.color = color
  }
  changeScale() {}
  changeOpacity(opacity) {
    this.opacity = opacity
  }
  drawTo(ctx, x, y, {rotation=0, pressure=1} = {}) {
    let oldOpacity = ctx.globalAlpha
    let oldStyle = ctx.fillStyle
    let oldMode = ctx.globalCompositeOperation
    ctx.globalAlpha = pressure * this.opacity
    ctx.fillStyle = this.color
    ctx.globalCompositeOperation = this.mode
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height)
    ctx.globalAlpha = oldOpacity
    ctx.fillStyle = oldStyle
    ctx.globalCompositeOperation = oldMode
  }
  drawOutline(ctx, x, y) {
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.lineTo(ctx.canvas.width, ctx.canvas.height)
    ctx.moveTo(ctx.canvas.width, 0)
    ctx.lineTo(0, ctx.canvas.height)
    ctx.strokeStyle = "#FFF"
    ctx.stroke()
  }
}

export class NoiseBrush extends ProceduralBrush {
  constructor(baseid, {
    rainbow=false,
    lightness=true,
    opacityness=false,
    round=false,
    tooltip=undefined,
    ...options} = {})
  {
    super(baseid, options)
    this.superInitialized
    this.rainbow = rainbow
    this.lightness = lightness
    this.opacityness = opacityness
    this.round = round
    this.previewSrc = undefined
    this.tooltip = tooltip || "Noise"
    this.updateBrush()
  }
  createBrush()
  {
    let ctx = this.overlayCanvas.getContext('2d')
    let {width, height} = this
    width = Math.floor(width)
    height = Math.floor(height)

    ctx.clearRect(0, 0, width, height)
    this.brushData = ctx.getImageData(0, 0, width, height)

    let hsl = this.ccolor.hsl()
    let noiseColor = this.ccolor

    let radius = width / 2

    for (let y = 0; y < height; ++y)
    {
      for (let x = 0; x < width; ++x)
      {
        if (this.rainbow)
        {
          this.brushData.data[((y * width) + x) * 4 + 0] = THREE.Math.randInt(0, 255)
          this.brushData.data[((y * width) + x) * 4 + 1] = THREE.Math.randInt(0, 255)
          this.brushData.data[((y * width) + x) * 4 + 2] = THREE.Math.randInt(0, 255)
        }
        else if (this.lightness)
        {
          let currentLightness = hsl.lightness()
          noiseColor = hsl.lightness(THREE.Math.randInt(currentLightness - currentLightness * this.opacity, currentLightness * this.opacity))
          this.brushData.data[((y * width) + x) * 4 + 0] = noiseColor.red()
          this.brushData.data[((y * width) + x) * 4 + 1] = noiseColor.green()
          this.brushData.data[((y * width) + x) * 4 + 2] = noiseColor.blue()
        }
        else
        {
          this.brushData.data[((y * width) + x) * 4 + 0] = noiseColor.red()
          this.brushData.data[((y * width) + x) * 4 + 1] = noiseColor.green()
          this.brushData.data[((y * width) + x) * 4 + 2] = noiseColor.blue()
        }

        if (this.opacityness)
        {
          this.brushData.data[((y * width) + x) * 4 + 3] = THREE.Math.randInt(0, 255)
        }
        else
        {
          this.brushData.data[((y * width) + x) * 4 + 3] = 255
        }

        if (this.round)
        {
          this.brushData.data[((y * width) + x) * 4 + 3] = Math.round(255 * (1 - Math.sqrt((x - width / 2) * (x - width / 2) + (y - width / 2) * (y - width / 2)) / radius))
        }
      }
    }

    ctx.putImageData(this.brushData, 0, 0)
  }
  drawTo(...args) {
    this.createBrush()
    super.drawTo(...args)
  }
}

export class FxBrush extends Brush {
  static schema() {
    return Object.assign({
      baseBrush: {
        type: 'brush',
        store: (brush) => {
          return brush.fullStore()
        },
        restore: (src) => {
          return Brush.fullRestore(src)
        }
      },
      type: {default: 'blur'}
    }, super.schema())
  }
  constructor(baseid, opts) {
    super(baseid)
    if (typeof opts === 'undefined')
    {
      opts = baseid
      baseid = opts.baseid
    }
    let {baseBrush, type, previewSrc, dragRotate = false, tooltip = undefined} = opts;
    this.baseBrush = baseBrush
    this.dragRotate = dragRotate
    this.type = type
    this.fx = new CanvasShaderProcessor({source: require(`./shaders/brush/${type}.glsl`)})

    this.tooltip = tooltip || (baseBrush.tooltip ? `${baseBrush.tooltip} (${type})` : Util.titleCase(type))

    for (let fn of ['changeColor', 'changeScale', 'changeOpacity', 'drawOutline'])
    {
      this[fn] = this.baseBrush[fn].bind(this.baseBrush)
    }
    this.baseUpdate = this.baseBrush.updateBrush.bind(this.baseBrush)
    this.baseBrush.updateBrush = this.updateBrush.bind(this)

    this.previewSrc = previewSrc ? previewSrc : this.baseBrush.previewSrc

  }
  get width() {
    return this.baseBrush.width
  }
  get height() {
    return this.baseBrush.height
  }
  clone() {
    let clone = super.clone()
    let baseBrush = this.baseBrush.clone()
    clone.baseBrush = baseBrush
    clone.fx = new CanvasShaderProcessor({source: this.fx.source})

    for (let fn of ['changeColor', 'changeScale', 'changeOpacity', 'drawOutline'])
    {
      clone[fn] = clone.baseBrush[fn].bind(clone.baseBrush)
    }
    clone.baseUpdate = Object.getPrototypeOf(this.baseBrush).updateBrush.bind(clone.baseBrush)
    clone.baseBrush.updateBrush = clone.updateBrush.bind(clone)
    return clone
  }
  store() {
    let obj = super.store()
    for (let a of this.storableAttributes.filter(i => i !== 'baseid'))
    {
      obj[a] = this.baseBrush[a]
    }
    return obj
  }
  updateBrush() {
    this.baseUpdate()

    this.fx.setCanvasAttribute("u_brush", this.baseBrush.overlayCanvas)
  }
  drawTo(ctx, x, y, opts) {
    this.fx.drawBrush(this.baseBrush, ctx, x, y, opts)
  }
}

export class LineBrush extends Brush
{
  constructor(baseid, {
    tooltip=undefined,
    mode="source-over",
    previewSrc
  } = {}) {
    super(baseid)
    this.scale = 1
    this.opacity = 1.0
    this.tooltip = tooltip
    this.outlineScale = 1
    this.mode = mode

    if (previewSrc)
    {
      this.previewSrc = previewSrc
    }
    else
    {
      let canvas = Util.createCanvas(32, 32)
      let ctx = canvas.getContext('2d')

      ctx.strokeStyle = "#FFF"
      ctx.beginPath()
      ctx.moveTo(0, 16)
      ctx.lineTo(32, 16)
      ctx.lineWidth = 3
      ctx.stroke()
      this.previewSrc = canvas.toDataURL()
    }

    this.unenumerable("color3")
    this.unenumerable("ccolor")
    this.unenumerable("brushdata")

    this.changeColor('#FFF')

    this.lineData = {}
  }

  changeColor(color) {
    this.color = color
    this.color3 = new THREE.Color(this.color)
    this.ccolor = Color(color)
  }

  changeScale(scale) {
    this.scale = scale
  }
  changeOpacity(opacity) {
    this.opacity = opacity
  }
  drawTo(ctx, x, y, opts = {}) {
    this.lineData.endPoint = {x,y}
  }
  startDrawing(ctx, x, y) {
    this.solo = true
    this.lineData.startPoint = {x,y}
  }
  endDrawing(ctx) {
    this.solo = false
    if (!this.lineData.startPoint && this.lineData.endPoint) return
    ctx.save()
    ctx.globalCompositeOperation = this.mode
    ctx.beginPath()
    ctx.moveTo(this.lineData.startPoint.x, this.lineData.startPoint.y)
    ctx.lineTo(this.lineData.endPoint.x, this.lineData.endPoint.y)
    ctx.strokeStyle = this.color
    ctx.globalAlpha *= this.opacity
    ctx.lineWidth = this.scale
    ctx.stroke()
    ctx.restore()

    this.lineData = {}

  }
  drawOutline(ctx, x,y) {
    ctx.beginPath()
    if (!this.lineData.startPoint || !this.lineData.endPoint)
    {
      ctx.beginPath()
      ctx.arc(x, y, this.scale * this.outlineScale, 0, 2 * Math.PI, false)
      ctx.strokeStyle = '#FFFFFF'
      ctx.stroke()
      return
    }

    ctx.beginPath()
    if (this.lineData.allPoints)
    {
      ctx.moveTo(this.lineData.startPoint.x, this.lineData.startPoint.y)
      for (let p of this.lineData.allPoints)
      {
        ctx.lineTo(p.x, p.y)
      }
    }
    else
    {
      ctx.moveTo(this.lineData.startPoint.x, this.lineData.startPoint.y)
      ctx.lineTo(this.lineData.endPoint.x, this.lineData.endPoint.y)
    }
    ctx.strokeStyle = '#FFFFFF'
    ctx.lineWidth = this.scale
    ctx.stroke()
  }
}

export class StretchBrush extends LineBrush {
  static schema() {
    return Object.assign({
      switchbackAngle: {default: 140},
      textured: {default: false},
      width: {default: 48},
      height: {default: 48},
      mode: {default: 'source-over'},
      image: {
        type: 'map',
        store: (img) => img.src,
        restore: (src) => {
          let img = new Image()
          img.src = src;
          return img
        }
      }
    }, super.schema())
  }
  constructor(baseid, name, {
    switchbackAngle = 140,
    user = false,
    ...options} = {})
  {
    let image
    if (name === undefined)
    {
      options = baseid
      baseid = options.baseid
      name = options.name
      image = options.image
    }

    super(baseid, options)
    this.user = options.user;

    let {textured} = options

    this.switchbackAngle = switchbackAngle


    if (image)
    {
    }
    else if (name instanceof Image || name instanceof HTMLCanvasElement)
    {
      image = name
      name = options.name
    }
    else if ('width' in options && 'height' in options) {
      image = new Image()
    }
    else
    {
      image = new Image()
    }

    this.width = options.width
    this.height = options.height
    this.outlineScale = 5

    image.decoding = 'sync'
    image.loading = 'eager'
    if (!image.src && !image.getCont) image.src = require(`./brushes/${name}.png`)

    this.image = image
    this.previewSrc = image
    this.image.decode().then(() => this.updateBrush())

    this.textured = textured

    this.uvStretcher = new UVStretcher({fx: textured ? 'uv-stretch-textured' : 'uv-stretch'})

    this.lineData.allPoints = []

    Pool.init(this)
  }
  updateBrush() {
    this.uvStretcher.setInputCanvas(this.image, {resize: false})
    this.uvStretcher.setUniform("u_color", "uniform3fv", this.color3.clone().convertLinearToSRGB().toArray())
  }
  drawTo(ctx, x, y, {scale = 1.0, pressure = 1.0} = {}) {
    if (!this.lineData.endPoint || (Math.abs(this.lineData.endPoint - x) > 1
     || Math.abs(this.lineData.endPoint.y - y) > 1 ))
    {
      if (this.lineData.allPoints.length > 2)
      {
        let oldVec = this.pool('oldVec', THREE.Vector3)
        let newVec = this.pool('newVec', THREE.Vector3)
        let len = this.lineData.allPoints.length
        oldVec.set(this.lineData.allPoints[len - 1].x - this.lineData.allPoints[len - 2].x,
                   this.lineData.allPoints[len - 1].y - this.lineData.allPoints[len - 2].y, 0);
        newVec.set(x - this.lineData.allPoints[len - 1].x,
                   y - this.lineData.allPoints[len - 1].y, 0);
        oldVec.normalize()
        newVec.normalize()
        let angle = oldVec.angleTo(newVec) * 180 / Math.PI;
        if (angle > this.switchbackAngle || angle < - this.switchbackAngle)
        {
          // console.log("Switchback", angle, oldVec, newVec)
          this.endDrawing(ctx)
          this.startDrawing(ctx, x, y)
        }
      }
      this.lineData.endPoint = {x,y}
      this.lineData.allPoints.push({x,y, scale: this.scale * scale, opacity: pressure})
    }
  }
  startDrawing(ctx, x, y) {
    this.lineData.startPoint = {x,y}
    // this.lineData.allPoints.push({x,y, scale: this.scale})
    this.solo = true
    this.direct = true
    if (this.uvStretcher.canvas.width !== ctx.canvas.width * 2 ||
        this.uvStretcher.canvas.height !== ctx.canvas.height * 2)
    {
      this.uvStretcher.canvas.width = ctx.canvas.width * 2
      this.uvStretcher.canvas.height = ctx.canvas.height * 2
    }
    this.updateBrush()
  }
  endDrawing(ctx) {
    this.solo = false
    this.direct = false
    if (this.lineData.allPoints.length < 2)
    {
      this.lineData.allPoints.length = 0
      this.lineData.endPoint = undefined
      return
    }

    for (let p of this.lineData.allPoints)
    {
      p.x /= ctx.canvas.width
      p.y /= ctx.canvas.height

      p.x = p.x * 2 - 1
      p.y = p.y * - 2 + 1
    }

    this.uvStretcher.createMesh(this.lineData.allPoints)

    this.uvStretcher.initialUpdate()
    this.uvStretcher.update()

    let oldAlpha = ctx.globalAlpha
    ctx.globalAlpha = Math.sqrt(this.opacity)
    ctx.globalCompositeOperation = this.mode
    ctx.drawImage(this.uvStretcher.canvas,
      0, 0, this.uvStretcher.canvas.width, this.uvStretcher.canvas.height,
      0, 0, ctx.canvas.width, ctx.canvas.height)

    this.lineData.allPoints.length = 0
    this.lineData.endPoint = undefined
    ctx.globalAlpha = oldAlpha

    if (ctx.canvas.touch) ctx.canvas.touch()

  }
  drawOutline(ctx, x,y) {
    if (!this.lineData.startPoint || !this.lineData.endPoint)
    {
      ctx.beginPath()
      ctx.arc(x, y, this.scale * this.outlineScale, 0, 2 * Math.PI, false)
      ctx.strokeStyle = '#FFFFFF'
      ctx.stroke()
      return
    }

    for (let p of this.lineData.allPoints)
    {
      p.nx = p.x
      p.ny = p.y
      p.x /= ctx.canvas.width
      p.y /= ctx.canvas.height

      p.x = p.x * 2 - 1
      p.y = p.y * - 2 + 1
    }

    this.uvStretcher.createMesh(this.lineData.allPoints)

    this.uvStretcher.initialUpdate()
    this.uvStretcher.setUniform("u_color", "uniform3fv", this.color3.clone().convertLinearToSRGB().toArray())
    this.uvStretcher.update()

    let oldAlpha = ctx.globalAlpha
    ctx.globalAlpha = Math.sqrt(this.opacity)
    ctx.drawImage(this.uvStretcher.canvas,
      0, 0, this.uvStretcher.canvas.width, this.uvStretcher.canvas.height,
      0, 0, ctx.canvas.width, ctx.canvas.height)

    ctx.globalAlpha = oldAlpha

    for (let p of this.lineData.allPoints)
    {
      p.x = p.nx
      p.y = p.ny
    }
  }
}

export class VectorBrush extends Brush {
  constructor(baseid, {
    tooltip=undefined,
    previewSrc
  } = {}) {
    super(baseid)
    this.opacity = 1.0
    this.tooltip = tooltip
    this.outlineScale = 1
    if (previewSrc)
    {
      this.previewSrc = previewSrc
    }
    else
    {
      let canvas = document.createElement('canvas')
      canvas.width = 32
      canvas.height = 32
      let ctx = canvas.getContext('2d')

      ctx.strokeStyle = "#FFF"
      ctx.beginPath()
      ctx.moveTo(0, 0)
      ctx.arcTo(32, 16, 32, 32, 12)
      ctx.lineWidth = 3
      ctx.stroke()
      this.previewSrc = canvas.toDataURL()
    }
    this.endPoint = new THREE.Vector2;
  }
  changeColor(color) {
    this.color = color
    this.color3 = new THREE.Color(this.color)
    this.ccolor = Color(color)
  }

  changeScale(scale) {
    this.scale = scale
  }
  changeOpacity(opacity) {
    this.opacity = opacity
  }
  drawTo(ctx, x, y, opts = {}) {
    this.endPoint.set(x, -y)
    if (this.shape.currentPoint.distanceTo(this.endPoint) > 5)
    {
      this.shape.lineTo(x, -y)
    }
  }
  startDrawing(ctx, x, y) {
    this.solo = true
    this.shape = new THREE.Shape();
    ctx.moveTo(x, y)
    this.shape.moveTo(x, -y)
  }
  endDrawing(ctx) {
    this.solo = false
    Compositor.el.emit('shapecreated', this.shape)
    console.log("Shape", this.shape)
    this.shape = undefined
  }
  drawOutline(ctx, x, y) {
    if (!this.shape || this.shape.curves.length === 0)
    {
      ctx.beginPath()
      ctx.arc(x, y, this.scale * this.outlineScale, 0, 2 * Math.PI, false)
      ctx.strokeStyle = '#FFFFFF'
      ctx.lineWidth = 1
      ctx.stroke()
      return
    }

    ctx.strokeStyle = '#FFFFFF'
    ctx.lineWidth = 1
    ctx.moveTo(this.shape.curves[0].v1.x, - this.shape.curves[0].v1.y)
    for (let line of this.shape.curves)
    {
      ctx.lineTo(line.v2.x, - line.v2.y)
    }
    ctx.stroke()
  }
}

export class FillShapeBrush extends VectorBrush{
  endDrawing(ctx) {
    this.solo = false
    ctx.beginPath()
    let oldGlobalAlpha = ctx.globalAlpha
    ctx.globalAlpha = Math.sqrt(this.opacity)
    ctx.fillStyle = "#" + this.color3.getHexString()
    ctx.moveTo(this.shape.curves[0].v1.x, - this.shape.curves[0].v1.y)
    for (let line of this.shape.curves)
    {
      ctx.lineTo(line.v2.x, - line.v2.y)
    }
    ctx.fill()
    ctx.globalAlpha = oldGlobalAlpha
    this.shape = undefined
  }
}

export class FloodFillBrush extends VectorBrush {
  drawTo(ctx, x, y, opts = {}) {
    // c.f. http://www.williammalone.com/articles/html5-canvas-javascript-paint-bucket-tool/
    // let imageData = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height)
    // let data = new Uint32Array(imageData.data.buffer)
    this.lastPos = {x, y}
  }
  endDrawing(ctx) {
    let points = MarchingSquaresOpt.getBlobOutlinePoints(ctx.canvas, undefined, 0, 10)
    console.log("Found", points)
    this.solo = false
    ctx.beginPath()
    let oldGlobalAlpha = ctx.globalAlpha
    ctx.globalAlpha = Math.sqrt(this.opacity)
    ctx.fillStyle = "#" + this.color3.getHexString()
    ctx.moveTo(points[0].x, points[0].y)
    for (let p of points)
    {
      ctx.lineTo(p.x, p.y)
    }
    ctx.fill()
    ctx.globalAlpha = oldGlobalAlpha
    this.shape = undefined
  }
}

const constructors = { Brush, ProceduralBrush, ImageBrush, LambdaBrush, FillBrush, NoiseBrush, FxBrush, LineBrush, StretchBrush, FillShapeBrush, FloodFillBrush};
