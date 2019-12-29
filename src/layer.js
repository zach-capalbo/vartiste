export class Layer {
  constructor(width, height) {
    this.width = width
    this.height = height
    this.offset = {x: 0, y: 0}
    this.mode = "source-over"
    this.visible = true

    let canvas = document.createElement("canvas")
    canvas.width = this.width
    canvas.height = this.height
    document.body.append(canvas)
    this.canvas = canvas;

    this.clear()
  }

  draw(ctx) {
    ctx.save()
    ctx.globalCompositeOperation = this.mode
    ctx.drawImage(this.canvas, 0, 0)
    ctx.restore()
  }

  clear() {
    let ctx = this.canvas.getContext('2d');
    ctx.clearRect(0, 0, this.width, this.height)
  }
}
