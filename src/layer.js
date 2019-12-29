export class Layer {
  constructor(width, height) {
    this.width = width
    this.height = height
    this.offset = {x: 0, y: 0}
    this.mode = "source-over"

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
    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height)
    ctx.strokeStyle = '#333'
  }
}
