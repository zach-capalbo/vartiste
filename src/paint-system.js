import {BrushList} from './brush-list.js'
import * as Brush from './brush.js'
import shortid from 'shortid'
import {Util} from './util.js'

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
    this.el.emit('brushchanged', {brush: this.brush, index})
  },

  // Sets whether the brush should be able to rotate while drawing
  setRotateBrush(shouldRotate) {
    this.data.rotateBrush = shouldRotate
    this.el.emit('rotatebrushchanged', shouldRotate)
  }
})

// Creates and sets a brush for painting.
//
// If `set-brush` is added to an entity with the [`pencil-tool`](#pencil-tool)
// or [`hand-draw-tool`](#hand-draw-tool) component also set, then it will
// change the brush associated with that component. Otherwise, it will not do
// anything until `activationEvent` is received, at which time it will set the
// scene-wide brush.
//
// The schema for this brush will be automatically updated depending on the
// `brushType` field. `brushType` should be set to one of the class names in [`brush.js`](https://gitlab.com/zach-geek/vartiste/-/blob/release/src/brush.js)
//
// I'm working on better documentation, but in the meantime, here are a few examples:
//
// ```
//    <a-entity pencil-tool="" set-brush="brushType: ImageBrush; color: red; opacity: 0.5; image: #asset-paint-img; scale: 2; autoRotate: false; dragRotate: true"></a-entity>
//    <a-entity icon-button="#asset-brush" set-brush="activationEvent: click; brushType: ProceduralBrush; color: #3a3a3a; opacity: 0.3; connected: true, hqBlending: true; mode: color-burn"></a-entity>
// ```
AFRAME.registerComponent('set-brush', {
  schema: {
    // Type of brush. Should be set to one of the class names in [`brush.js`](https://gitlab.com/zach-geek/vartiste/-/blob/release/src/brush.js)
    brushType: {type: 'string'},

    // Event to listen for to set system-wide brush
    activationEvent: {default: 'set-brush'},
  },
  init() {
    this.activate = this.activate.bind(this)
  },
  updateSchema(newData) {
    console.log("Brush schema", this.data, newData)
    if (!this.data || newData.brushType !== this.data.brushType)
    {
      this.extendSchema(Brush[newData.brushType].schema())
    }
  },
  update(oldData) {
    if (this.data.activationEvent !== oldData.activationEvent)
    {
      if (oldData.activationEvent)
      {
        this.el.removeEventListener(oldData.activationEvent, this.activate)
      }
      this.el.addEventListener(this.data.activationEvent, this.activate)
    }
    console.log("Brush update", this.data, oldData)
    switch (this.data.brushType)
    {
      case "ImageBrush":
        this.brush = new Brush.ImageBrush(shortid.generate(), this.data.image, this.data)
      break;
      case "ProceduralBrush":
        this.brush = new Brush.ProceduralBrush(shortid.generate(), this.data)
      break;
      case "StretchBrush":
        this.brush = new Brush.StretchBrush(shortid.generate, this.data.image, this.data)
      break;
      default:
        console.error("Brush type not yet supported", this.data.brushType)
        return
    }

    console.log("Loaded brush", this.data.color, this.brush)
    this.brush.changeScale(this.data.scale)
    this.brush.changeColor(this.data.color)
    this.brush.changeOpacity(this.data.opacity)

    if (this.el.components['hand-draw-tool'])
    {
      this.activate()
    }
  },
  activate() {
    if (!this.brush) return;

    if (this.el.components['hand-draw-tool'])
    {
      this.el.components['hand-draw-tool'].system.brush = this.brush
    }
    else
    {
      this.el.sceneEl.systems['paint-system'].brush = this.brush
    }
  }
})
