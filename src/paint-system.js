AFRAME.registerSystem('paint-system', {
  schema: {
    color: {type: 'color', default: '#000'},
    brushScale: {type: 'float', default: 1}
  },

  init() {
    this.linearBrushScale = 0
  },

  selectColor(color) {
    console.log("Setting color", color)
    this.data.color = color
    this.el.emit('colorchanged', {color})
  },

  scaleBrush(delta) {
    console.log("Scaling brush by", delta)
    this.linearBrushScale += delta / 1000
    this.data.brushScale = Math.exp(this.linearBrushScale)
    this.el.emit('brushscalechanged', {brushScale: this.data.brushScale})
  }
})
