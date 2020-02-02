import Convolve from "convolve"

class Brush {}

class ProceduralBrush extends Brush {
  constructor({
    width=20,
    height=20,
    distanceBased=false,
    maxDistance=1.5,
    connected=false,
    autoRotate=false,
    hqBlending=false,
    drawEdges=false,
    ...options} = {})
  {
    super();

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

    let overlayCanvas = document.createElement("canvas")
    overlayCanvas.width = width
    overlayCanvas.height = height
    this.overlayCanvas = overlayCanvas;

    this.changeColor('#FFF')
  }

  changeColor(color) {
    this.color = color
    this.color3 = new THREE.Color(this.color)

    this.updateBrush()
  }

  changeScale(scale) {
    this.scale = scale

    this.width = this.baseWidth * scale
    this.height = this.baseHeight * scale
    this.overlayCanvas.width = this.width
    this.overlayCanvas.height = this.height

    this.updateBrush()
  }

  changeOpacity(opacity) {
    this.opacity = opacity
  }

  createBrush() {
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
    this.createBrush()
    let ctx = this.overlayCanvas.getContext("2d")
    let {width, height} = this
    if (this.hqBlending)
    {
      this.brushData = ctx.getImageData(0, 0, width, height)
    }

    if (!this.previewSrc)
    {
      this.previewSrc = this.overlayCanvas.toDataURL()
    }

    this.createOutline(this.overlayCanvas)
    this.brushData = ctx.getImageData(0, 0, width, height)
  }

  createOutline(source) {
    if (!this.drawEdges) return
    let {width, height} = source
    this.outlineCanvas = this.outlineCanvas || document.createElement('canvas')
    this.outlineCanvas.width = width
    this.outlineCanvas.height = height

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

  drawTo(ctx, x, y, {rotation=0, pressure=1.0, distance=0.0, eraser=false, scale=1.0, imageData=undefined} = {}) {
    if (!imageData)
    {
      ctx.save()

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
      ctx.rotate(this.autoRotate ? 2*Math.PI*Math.random() : rotation)

      if (this.distanceBased){
        let scale = ctx.globalAlpha * 2
        ctx.scale(1/scale, 1/scale)
      }

      ctx.scale(scale, scale)

      ctx.drawImage(this.overlayCanvas, - this.width / 2, - this.height / 2)
      ctx.restore()
      return
    }

    let {width, height} = this
    width = Math.floor(width)
    height = Math.floor(height)

    let brushData = this.brushData

    let yi, xi

    let carryVal = {r:0,g:0,b:0,clerp:0}

    let bufIdx
    let canvasIdx
    x = Math.floor(x - width / 2)
    y = Math.floor(y - height / 2)
    let cwidth = Math.floor(ctx.canvas.width)
    let setData = (data, c, v) => data.data[Math.floor(4 * ((yi + y) * cwidth + (xi + x))) + c] = v
    let val, f
    let imageOpacity
    let brushOpacity

    let lerp
    let clerp
    let targetAlpha

    let imageDataData = imageData.data
    let brushDataData = brushData.data

    ctx.globalAlpha = 1

    for (yi = 0; yi < height; ++yi)
    {
      for (xi = 0; xi < width; ++xi)
      {
        bufIdx = (4 * (yi * width + xi))
        canvasIdx = Math.floor(4 * ((yi + y) * cwidth + (xi + x)))
        brushOpacity = brushDataData[bufIdx + 3]
        imageOpacity = imageDataData[canvasIdx + 3]
        lerp = brushOpacity * this.opacity * pressure / 255 + Math.random() * this.opacity * 0.01
        clerp = lerp
        carryVal.clerp = (Math.round(lerp * 255) - lerp * 255) / 255
        targetAlpha = THREE.Math.clamp(imageOpacity + brushOpacity * this.opacity * pressure, 0, 255)

        if (imageOpacity < (1 + Math.random() * 1) * brushOpacity)
        {
          clerp = clerp + (1.0 - imageOpacity / 255.0)
        }

        if (clerp * 255.0 < 1)
        {
          carryVal.clerp += clerp
          continue
        }

        clerp = THREE.Math.clamp(clerp, 0, 1)

        imageDataData[canvasIdx + 0] = THREE.Math.lerp(imageDataData[canvasIdx + 0], this.carry(carryVal, 'r'), clerp)
        imageDataData[canvasIdx + 1] = THREE.Math.lerp(imageDataData[canvasIdx + 1], this.carry(carryVal, 'g'), clerp)
        imageDataData[canvasIdx + 2] = THREE.Math.lerp(imageDataData[canvasIdx + 2], this.carry(carryVal, 'b'), clerp)
        imageDataData[canvasIdx + 3] = THREE.Math.lerp(imageDataData[canvasIdx + 3], 255, lerp)
      }
    }
  }

  drawOutline(ctx, x, y, {distance=0, rotation=0} = {})
  {
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

      ctx.drawImage(this.outlineCanvas, -width / 2, - height / 2, width, height)

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

class ImageBrush extends ProceduralBrush{
  constructor(name, options = {}) {
    let image;

    if ('width' in options && 'height' in options) {
      image = new Image(options.width, options.height)
    }
    else
    {
      image = new Image()
    }
    image.src = require(`./brushes/${name}.png`)
    let {width, height} = image

    super(Object.assign({drawEdges: true}, options, {width, height}))

    this.image = image
    this.previewSrc = image
    this.updateBrush()
  }

  createBrush() {
    if (!this.image) return;

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

class LambdaBrush extends ProceduralBrush {
  constructor(options={}, lambda) {
    super(options)
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

class FillBrush extends Brush {
  constructor({mode = "source-over", previewSrc} = {}) {
    super();
    this.previewSrc = previewSrc || require('./assets/format-color-fill.png')
    this.mode = mode
    this.hqBlending = false
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

export { Brush, ProceduralBrush, ImageBrush, LambdaBrush, FillBrush};
