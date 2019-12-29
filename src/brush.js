class Brush {}

class ProceduralBrush extends Brush {
  constructor(ctx) {
    super();

    let [width, height] = [20, 20]
    this.width = width
    this.height = height

    let overlayCanvas = document.createElement("canvas")
    overlayCanvas.width = width
    overlayCanvas.height = height
    document.body.append(overlayCanvas)

    overlayCanvas.getContext('2d').clearRect(0, 0, width, height)

    this.overlayCanvas = overlayCanvas;

    this.createBrush()
  }

  createBrush() {
    let ctx = this.overlayCanvas.getContext("2d")

    const width = this.width
    const height = this.height
    const innerRadius = 2
    const outerRadius = width / 2

    let x = width / 2
    let y = height / 2

    let gradient = ctx.createRadialGradient(x, y, innerRadius, x, y, outerRadius)
    gradient.addColorStop(0, "rgba(0, 0, 0, 0.7)");
    gradient.addColorStop(1, "rgba(0, 0, 0, 0)");

    // ctx.fillStyle = 'rgba(0,0,0,0.3)'
    ctx.fillStyle = gradient
    ctx.fillRect(0,0,width,height)
  }

  drawTo(ctx, x, y) {
    ctx.drawImage(this.overlayCanvas, x - this.width, y + this.height / 2)
  }
}

export { Brush, ProceduralBrush };
