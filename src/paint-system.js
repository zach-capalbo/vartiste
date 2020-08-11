import {BrushList} from './brush-list.js'

AFRAME.registerSystem('paint-system', {
  schema: {
    color: {type: 'color', default: '#000'},
    opacity: {type: 'float', default: 0.7},
    brushScale: {type: 'float', default: 1},
    brushIndex: {type: 'int', default: 0},
    rotateBrush: {type: 'bool', default: true},
    wrapX: {type: 'bool', default: false},
    wrapY: {type: 'bool', default: false},
  },

  init() {
    this.linearBrushScale = 0
    this.brush = BrushList[this.data.brushIndex]
    this.brush.changeColor(this.data.color)
  },

  selectColor(color) {
    this.data.color = color
    this.brush.changeColor(color)
    this.el.emit('colorchanged', {color})
  },

  selectOpacity(opacity) {
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
    let idx = this.data.brushIndex - 1
    if (idx < 0) idx += BrushList.length
    this.selectBrush(idx % BrushList.length)
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
  setRotateBrush(shouldRotate) {
    this.data.rotateBrush = shouldRotate
    this.el.emit('rotatebrushchanged', shouldRotate)
  }
})
