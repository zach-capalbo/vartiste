import {ProceduralBrush} from './brush.js'

AFRAME.registerComponent('draw-canvas', {
  schema: {canvas: {type: 'selector'}},

  init() {
    this.clear()
    this.brush = new ProceduralBrush(this.data.canvas.getContext('2d'));
  },

  clear() {
    let ctx = this.data.canvas.getContext('2d');
    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(0, 0, this.data.canvas.width, this.data.canvas.height)
    ctx.strokeStyle = '#333'
  },

  drawUV(uv, {pressure = 1.0, canvas = null}) {
    if (canvas == null) canvas = this.data.canvas
    let ctx = canvas.getContext('2d');

    ctx.globalAlpha = pressure
    this.brush.drawTo(ctx,  canvas.width * uv.x, canvas.height * (1 - uv.y))
    ctx.globalAlpha = 1.0
  }
});
