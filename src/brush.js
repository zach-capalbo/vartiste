class Brush {}

class ProceduralBrush extends Brush {
  constructor({width=20,height=20, ...options} = {}) {
    super();

    this.baseWidth = width
    this.baseHeight = height
    this.width = width
    this.height = height
    this.scale = 1
    this.opacity = 1.0
    this.options = options

    let overlayCanvas = document.createElement("canvas")
    overlayCanvas.width = width
    overlayCanvas.height = height
    //document.body.append(overlayCanvas)

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

    const width = this.width
    const height = this.height

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
    gradient.addColorStop(0, `rgba(${255 * color.r}, ${255 * color.g}, ${255 * color.b}, 0.7)`);
    gradient.addColorStop(1, `rgba(${255 * color.r}, ${255 * color.g}, ${255 * color.b}, 0)`);

    ctx.fillStyle = gradient
    ctx.fillRect(0,0,width,height)

    if (!this.previewSrc)
    {
      this.previewSrc = this.overlayCanvas.toDataURL()
    }
  }

  drawTo(ctx, x, y, {rotation=0} = {}) {
    ctx.save()
    ctx.globalAlpha *= this.opacity
    ctx.translate(x,y)
    ctx.rotate(rotation)
    //ctx.translate(2 * x, 2 * y)
    ctx.drawImage(this.overlayCanvas, - this.width / 2, - this.height / 2)
    //ctx.drawImage(this.overlayCanvas, x - this.width / 2, y - this.height / 2)
    ctx.restore()
  }

  drawOutline(ctx, x, y)
  {
    const width = this.width
    const height = this.height

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

export { Brush, ProceduralBrush, ImageBrush };
