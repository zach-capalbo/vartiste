import {ProceduralBrush} from './brush.js'

AFRAME.registerComponent('draw-checker', {
  dependencies: ['raycaster', 'laser-controls'],
  init() {
    this.intersects = []
    this.el.addEventListener('triggerdown', (e) => {
      this.isDrawing = true
    })
    this.el.addEventListener('triggerup', (e) => {
      this.isDrawing = false
    })
    this.el.addEventListener('raycaster-intersection', (e) => {
      this.intersects.push(e.detail.els[0])
    })
    this.el.addEventListener('raycaster-intersection-cleared', (e) => {
      this.intersects.splice(this.intersects.indexOf(e.el, 1))
    })
  },
  tick() {
    if (this.isDrawing) {
      console.log(this.intersects)
      for (var el of this.intersects)
      {
        let intersection = this.el.components.raycaster.getIntersection(el)
        el.components['draw-canvas'].drawUV(intersection.uv)
      }
    }
  }
})

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

  drawUV(uv) {
    let canvas = this.data.canvas;
    let ctx = this.data.canvas.getContext('2d');

    this.brush.drawTo(ctx,  canvas.width * uv.x, canvas.height * (1 - uv.y))
    // ctx.beginPath();
    // ctx.moveTo(0, 0);
    // ctx.lineTo(canvas.width * uv.x, canvas.height * (1 - uv.y))
    // ctx.stroke()
  }
});
