import {BrushList} from './brush-list.js'

AFRAME.registerSystem('paint-system', {
  schema: {
    color: {type: 'color', default: '#000'},
    opacity: {type: 'float', default: 0.7},
    brushScale: {type: 'float', default: 1},
    brushIndex: {type: 'int', default: 0}
  },

  init() {
    this.linearBrushScale = 0
    this.brush = BrushList[this.data.brushIndex]
    this.brush.changeColor(this.data.color)
  },

  selectColor(color) {
    console.log("Setting color", color)
    this.data.color = color
    this.brush.changeColor(color)
    this.el.emit('colorchanged', {color})
  },

  selectOpacity(opacity) {
    console.log("Setting opacity", opacity)
    this.data.opacity = opacity
    this.brush.changeOpacity(opacity)
    this.el.emit('opacitychanged', {opacity})
  },

  scaleBrush(delta) {
    console.log("Scaling brush by", delta)
    this.linearBrushScale += delta / 1000
    this.data.brushScale = Math.exp(this.linearBrushScale)
    this.brush.changeScale(this.data.brushScale)
    this.el.emit('brushscalechanged', {brushScale: this.data.brushScale})
  },

  prevBrush() {
    this.selectBrush((this.data.brushIndex + BrushList.length - 1) % BrushList.length)
  },
  nextBrush() {
    this.selectBrush((this.data.brushIndex + 1) % BrushList.length)
  },
  selectBrush(index) {
    this.data.brushIndex = index
    this.brush = BrushList[this.data.brushIndex]
    this.brush.changeColor(this.data.color)
    this.brush.changeScale(this.data.brushScale)
    this.brush.changeOpacity(this.data.opacity)
    this.el.emit('brushchanged', {brush: this.brush})
  },
})
