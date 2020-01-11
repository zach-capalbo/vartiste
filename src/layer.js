import shortid from 'shortid'
export class Layer {
  constructor(width, height) {
    this.width = width
    this.height = height

    if (!(Number.isInteger(width) && width > 0)) throw new Error(`Invalid layer width ${width}`)
    if (!(Number.isInteger(height) && height > 0)) throw new Error(`Invalid layer width ${height}`)

    this.transform = this.constructor.EmptyTransform()
    this.mode = "source-over"
    this.visible = true
    this.active = false
    this.grabbed = false
    this.opacity = 1.0
    this.id = shortid.generate()

    let canvas = document.createElement("canvas")
    canvas.width = this.width
    canvas.height = this.height
    canvas.id = `layer-${this.id}`
    document.body.append(canvas)
    this.canvas = canvas;
    document.body.append(canvas)

    this.clear()
  }

  draw(ctx) {
    ctx.save()
    ctx.globalCompositeOperation = this.mode
    ctx.globalAlpha = this.opacity
    let {translation, scale} = this.transform
    ctx.drawImage(this.canvas, 0, 0, this.width, this.height,
      translation.x - this.width / 2 * scale.x + this.width / 2,
      translation.y- this.height / 2 * scale.y + this.height / 2,
      this.width * scale.x, this.height * scale.y,
    )
    // ctx.translate(translation.x + this.width / 2, translation.y + this.height / 2)
    // ctx.scale(scale.x, scale.y)
    // ctx.rotate(this.transform.rotation)
    // ctx.drawImage(this.canvas, -this.width / 2, -this.height / 2)
    ctx.restore()
  }

  clear() {
    let ctx = this.canvas.getContext('2d');
    ctx.clearRect(0, 0, this.width, this.height)
  }

  resize(width, height) {
    this.canvas.width = width
    this.canvas.height = height
    this.width = width
    this.height = height
  }

  static EmptyTransform() {
    return {
      translation: {x: 0,y: 0},
      scale: {x: 1,y: 1},
      rotation: 0.0
    }
  }
}
