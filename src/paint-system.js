import {BrushList} from './brush-list.js'

AFRAME.registerSystem('paint-system', {
  schema: {
    color: {type: 'color', default: '#000'},
    brushScale: {type: 'float', default: 1},
    brushIndex: {type: 'int', default: 0}
  },

  init() {
    this.linearBrushScale = 0
    this.brush = BrushList[this.data.brushIndex]
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
  },

  nextBrush() {
    this.data.brushIndex = (this.data.brushIndex + 1) % BrushList.length
    this.brush = BrushList[this.data.brushIndex]
    this.brush.changeColor(this.data.color)
    this.brush.changeScale(this.data.brushScale)
    this.el.emit('brushchanged', {brush: this.brush})
  },
})
