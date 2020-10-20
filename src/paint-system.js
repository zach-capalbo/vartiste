import {BrushList} from './brush-list.js'
import * as Brush from './brush.js'

// Manages drawing options such as paint brush and color
AFRAME.registerSystem('paint-system', {
  schema: {
    color: {type: 'color', default: '#000'},
    opacity: {type: 'float', default: 0.7},
    brushScale: {type: 'float', default: 1},
    // Index into the brush list provided by `brush-list.js`
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

  // Sets the color of the current brush. Can be a hex string or a csv color name
  selectColor(color) {
    this.data.color = color
    this.brush.changeColor(color)
    this.el.emit('colorchanged', {color})
  },

  // Sets the opacity for drawing
  selectOpacity(opacity) {
    this.data.opacity = opacity
    this.brush.changeOpacity(opacity)
    this.el.emit('opacitychanged', {opacity})
  },

  // Scales the brush by `delta`
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

  // Selects the brush at position `index` from [`BrushList`](https://gitlab.com/zach-geek/vartiste/-/blob/release/src/brush-list.js)
  selectBrush(index) {
    this.data.brushIndex = index
    this.brush = BrushList[this.data.brushIndex]
    this.brush.changeColor(this.data.color)
    this.brush.changeScale(this.data.brushScale)
    this.brush.changeOpacity(this.data.opacity)
    this.el.emit('brushchanged', {brush: this.brush})
  },

  // Sets whether the brush should be able to rotate while drawing
  setRotateBrush(shouldRotate) {
    this.data.rotateBrush = shouldRotate
    this.el.emit('rotatebrushchanged', shouldRotate)
  }
})

const DEFAULT_BRUSH_LOADER_SCHEMA = {
  brushType: {type: 'string'}
}

AFRAME.registerComponent('brush-loader', {
  schema: DEFAULT_BRUSH_LOADER_SCHEMA,
  init() {

  },
  updateSchema(newData) {
    console.log("Brush schema", this.data, newData)
    if (!this.data || newData.brushType !== this.data.brushType)
    {
      this.extendSchema(DEFAULT_BRUSH_LOADER_SCHEMA)
    }
  },
  update(oldData) {
    console.log("Brush update", this.data, oldData)
    if (!oldData || this.data.brushType !== oldData.brushType)
    {
        this.brush = new Brush[this.data.brushType]("","", this.data)
    }
  }
})
