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

    let overlayCanvas = document.createElement("canvas")
    overlayCanvas.width = width
    overlayCanvas.height = height
    this.overlayCanvas = overlayCanvas;

    this.changeColor('#FFF')
  }

  changeColor(color) {
    this.color = color
    this.color3 = new THREE.Color(this.color)

    this.createBrush()
  }

  changeScale(scale) {
    this.scale = scale

    this.width = this.baseWidth * scale
    this.height = this.baseHeight * scale
    this.overlayCanvas.width = this.width
    this.overlayCanvas.height = this.height

    this.createBrush()
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

    if (!this.previewSrc)
    {
      this.previewSrc = this.overlayCanvas.toDataURL()
    }
  }

  drawTo(ctx, x, y, {rotation=0, pressure=1.0, distance=0.0, eraser=false} = {}) {
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
    //ctx.translate(2 * x, 2 * y)
    if (this.distanceBased){
      let scale = ctx.globalAlpha * 2
      ctx.scale(1/scale, 1/scale)
    }

    if (!this.hqBlending || eraser || ctx.globalAlpha > 0.1)
    {
      ctx.drawImage(this.overlayCanvas, - this.width / 2, - this.height / 2)
      ctx.restore()
      return
    }

    let {width, height} = this
    width = Math.floor(width)
    height = Math.floor(height)

    let brushCtx = this.overlayCanvas.getContext('2d')
    let imageData = ctx.getImageData(x-width / 2, y- height / 2, width, height)
    let brushData = brushCtx.getImageData(0, 0, width, height)

    let yi, xi

    let carryVal = {r:0,g:0,b:0,clerp:0}

    let sample = (data, c) => data.data[Math.floor(4 * (yi * width + xi) + c)]
    let setData = (data, c, v) => data.data[Math.floor(4 * (yi * width + xi) + c)] = v
    let carry = (c) => {
      let val = THREE.Math.clamp(this.color3[c] * 255 + carryVal[c], 0, 255)
      let f = Math.round(val)
      carryVal[c] = val - f
      return f
    }

    ctx.globalAlpha = 1

    for (yi = 0; yi < height; ++yi)
    {
      for (xi = 0; xi < width; ++xi)
      {
        let lerp = sample(brushData, 3) * this.opacity * pressure / 255 + Math.random() * this.opacity * 0.01
        let clerp = lerp//Math.max(lerp, 1.0 - sample(imageData, 3) )
        clerp += carryVal.clerp
        carryVal.clerp = (Math.round(clerp * 255) - clerp * 255) / 255

        let targetAlpha = Math.max(sample(imageData, 3), sample(brushData, 3))

        // console.log(x, y, lerp)
        setData(imageData, 0, THREE.Math.lerp(sample(imageData, 0), carry('r'), clerp))
        setData(imageData, 1, THREE.Math.lerp(sample(imageData, 1), carry('g'), clerp))
        setData(imageData, 2, THREE.Math.lerp(sample(imageData, 2), carry('b'), clerp))
        setData(imageData, 3, THREE.Math.lerp(sample(imageData, 3), targetAlpha, lerp))
      }
    }

    ctx.putImageData(imageData, x -width / 2, y - height / 2)

    ctx.restore()
  }

  drawOutline(ctx, x, y, {distance=0} = {})
  {
    const width = this.width
    const height = this.height
    let oldAlpha = ctx.globalAlpha

    if (this.distanceBased)
    {
      ctx.globalAlpha = Math.max(0, (this.maxDistance - distance) / this.maxDistance)
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

    super(Object.assign({}, options, {width, height}))

    this.image = image
    this.previewSrc = image
    this.createBrush()
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
    this.createBrush()
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

class GradientBrush extends ProceduralBrush {
  constructor(...opts) {
    super(...opts)
  }
  createBrush() {
    if (this.previewSrc) return
    super.createBrush()
  }
  drawTo(ctx, x, y, {rotation=0, pressure=1.0, distance=0.0} = {}) {
    ctx.save()
    ctx.translate(x,y)
    ctx.rotate(Math.random() * Math.PI)

    let {width, height} = this

    let {innerRadius = 2} = this.options
    const {outerRadius = width / 2} = this.options

    if (this.options.hardness)
    {
      innerRadius = width / 2 * this.options.hardness
    }

    let xx = 0//width / 2
    let yy = 0//height / 2

    let color = this.color3
    let gradient = ctx.createRadialGradient(xx, yy, innerRadius, xx, yy, outerRadius)
    gradient.addColorStop(0, `rgba(${255 * color.r}, ${255 * color.g}, ${255 * color.b}, ${pressure * this.opacity + Math.random() * 0.01})`);
    gradient.addColorStop(0.4 + Math.random() * 0.2, `rgba(${255 * color.r}, ${255 * color.g}, ${255 * color.b}, ${pressure * this.opacity / 2})`);
    gradient.addColorStop(1, `rgba(${255 * color.r}, ${255 * color.g}, ${255 * color.b}, ${Math.random() * 0.01})`);

    // ctx.fillStyle = gradient
    // ctx.fillRect(-this.width / 2,-this.height / 2,this.width,this.height)




    ctx.restore()
  }
}

export { Brush, ProceduralBrush, ImageBrush, LambdaBrush, FillBrush, GradientBrush };
