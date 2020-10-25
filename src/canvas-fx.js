import {Util} from './util.js'
import {Pool} from './pool.js'
import {Undo} from './undo.js'
import {bumpCanvasToNormalCanvas} from './material-transformations.js'
import {CanvasShaderProcessor} from './canvas-shader-processor.js'
import {FX} from './layer-modes.js'

// Allows you to easily run predifined shader effects without needing to worry
// about setting up a [`CanvasShaderProcessor`](#CanvasShaderProcessor)
//
// Use the `availableFX` property to see which effects are available.
AFRAME.registerSystem('canvas-fx', {
  init() {
    this.processors = {}
    this.availableFX = FX
  },
  processorFor(fx) {
    if (fx in this.processors) return this.processors[fx];
    this.processors[fx] = new CanvasShaderProcessor({fx})
    return this.processors[fx]
  },

  // Applies the effect named by `fx` to the canvas given by `canvas`. `fx` must
  // be one of the preset effects listed in `availableFX`
  applyFX(fx, canvas) {
    if (!canvas) canvas = Compositor.drawableCanvas
    Undo.pushCanvas(canvas)
    let processor = this.processorFor(fx)
    processor.setInputCanvas(canvas)
    processor.update()
    let ctx = canvas.getContext('2d')
    let oldOperation = ctx.globalCompositeOperation
    ctx.globalCompositeOperation = 'copy'
    ctx.drawImage(processor.canvas, 0, 0)
    ctx.globalCompositeOperation = oldOperation
    if (canvas.touch) canvas.touch()
    return canvas
  },
})
