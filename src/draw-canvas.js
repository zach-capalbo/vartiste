import {ProceduralBrush} from './brush.js'

AFRAME.registerComponent('draw-canvas', {
  schema: {canvas: {type: 'selector'}},

  init() {
    this.brush = new ProceduralBrush(this.data.canvas.getContext('2d'));
    this.brush.changeColor(this.el.sceneEl.systems['paint-system'].data.color)

    this.el.sceneEl.addEventListener('colorchanged', (e) => {
      this.brush.changeColor(e.detail.color)
    })
  },

  drawUV(uv, {pressure = 1.0, canvas = null}) {
    if (canvas == null) canvas = this.data.canvas
    let ctx = canvas.getContext('2d');

    ctx.globalAlpha = pressure
    this.brush.drawTo(ctx,  canvas.width * uv.x, canvas.height * (1 - uv.y))
    ctx.globalAlpha = 1.0
  }
});
