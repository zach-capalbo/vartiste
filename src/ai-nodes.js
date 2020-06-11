import {Node, CanvasNode} from './layer.js'
const STYLE_MODEL_PATH = require('./ai-models/saved_model_style_js/model.json')
const TRANSFORM_MODEL_PATH = require('./ai-models/saved_model_transformer_separable_js/model.json')
const RENDER_MODEL_PATH = require('./ai-models/render/model.json')

var requireAI = require.context('./ai-models', true, /./);
requireAI.keys().forEach(requireAI);

AFRAME.registerSystem('ai', {
  init() {
  },
  async tf() {
    if (this._tf) return this._tf

    this._tf = await import('@tensorflow/tfjs')
    this._tf.ENV.set('WEBGL_PACK', false);  // This needs to be done otherwise things run very slow v1.0.4
    return this._tf
  },
  async loadModels() {
    if (this.loadingModels) return await this.loadingModels

    this.loadingModels = (async () => {
      console.log("initializing ai")
      let tf = await this.tf()
      this.styleNet = await tf.loadGraphModel(STYLE_MODEL_PATH);
      this.transformNet = await tf.loadGraphModel(TRANSFORM_MODEL_PATH)
    })()

    return await this.loadingModels
  },
  async loadRenderModels() {
    if (this.loadingRenderModels) return await this.loadingRenderModels

    this.loadingRenderModels = (async () => {
      console.log("Loading render model")

      let tf = await this.tf()
      this.renderNet = await tf.loadGraphModel(RENDER_MODEL_PATH)
    })()

    return await this.loadingRenderModels
  }
})

export class StyleTransferNode extends CanvasNode {
  constructor(compositor, {shader = "blur", ...opts} = {}) {
    super(compositor, opts)
    Object.defineProperty(this, "system", {enumerable: false, value: AFRAME.scenes[0].systems.ai})
    Object.defineProperty(this, "data", {enumerable: false, value: {}})

  }
  disconnectDestination()
  {
    this.destination = undefined
  }
  touch() {
    super.touch()
    this.data.styleEncodingTime = 0
  }
  async updateCanvas(frame) {
    if (!this.destination) return
    let canvas = this.canvas

    if (!this.checkIfUpdateNeeded(frame)) return

    if (!this.sources[0]) return

    if (this.data.isRunningInference) {
      this.data.resetUpdateTime
      return
    }
    this.data.isRunningInference = true
    await this.runInference()
    this.data.isRunningInference = false

    this.updateTime = document.querySelector('a-scene').time

    if (this.resetUpdateTime)
    {
      this.updateTime = 0
    }

  }
  async runInference() {
    await this.system.loadModels()
    let tf = await this.system.tf()
    let {styleNet, transformNet} = this.system
    await tf.nextFrame()

    if (!this.data.styleEncoding || this.sources[0].updateTime >= this.data.styleEncodingTime)
    {
      if (this.data.styleEncoding) this.data.styleEncoding.dispose()
      let styleImage = this.sources[0].canvas
      this.data.styleEncoding = await tf.tidy(() => {
        this.data.styleEncodingTime = document.querySelector('a-scene').time
        return styleNet.predict(tf.browser.fromPixels(styleImage).toFloat().div(tf.scalar(255)).expandDims());
      })
    }

    console.log("BottleNeck predicted")

    await tf.nextFrame();
    const stylized = await tf.tidy(() => {
      return transformNet.predict([tf.browser.fromPixels(this.destination.canvas).toFloat().div(tf.scalar(255)).expandDims(), this.data.styleEncoding]).squeeze();
    })

    console.log("Stylized predicted")

    await tf.browser.toPixels(stylized, this.canvas);
    stylized.dispose();
  }
}

export class AIRenderNode extends CanvasNode {
  constructor(compositor, opts = {}) {
    super(compositor, opts)
    Object.defineProperty(this, "system", {enumerable: false, value: AFRAME.scenes[0].systems.ai})
    Object.defineProperty(this, "data", {enumerable: false, value: {}})
  }

  disconnectDestination()
  {
    this.destination = undefined
  }
  touch() {
    super.touch()
    this.data.styleEncodingTime = 0
  }
  async updateCanvas(frame) {
    if (!this.destination) return
    let canvas = this.canvas

    if (!this.checkIfUpdateNeeded(frame)) return


    if (this.data.isRunningInference) {
      this.data.resetUpdateTime
      return
    }

    this.data.isRunningInference = true
    await this.runInference()
    this.data.isRunningInference = false

    this.updateTime = document.querySelector('a-scene').time

    if (this.resetUpdateTime)
    {
      this.updateTime = 0
    }
  }
  async runInference() {
    await this.system.loadRenderModels()
    let tf = await this.system.tf()
    let {renderNet} = this.system
    await tf.nextFrame()

    let inputCanvas = this.destination.canvas

    let rendered = await tf.tidy(() => {
      let input = tf.browser.fromPixels(inputCanvas).toFloat().div(tf.scalar(127.5)).sub(1.0)
      input = tf.image.resizeBilinear(input, [256,256])
      let res = renderNet.predict(input.expandDims(), {training: true}).add(tf.scalar(1)).mul(0.5).squeeze()
      res = tf.image.resizeBilinear(res, [inputCanvas.height, inputCanvas.width])
      return res
    })

    await tf.browser.toPixels(rendered, this.canvas)
    rendered.dispose()
  }
}
