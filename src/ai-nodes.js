import {Node, CanvasNode} from './layer.js'
import * as tf from '@tensorflow/tfjs';
tf.ENV.set('WEBGL_PACK', false);  // This needs to be done otherwise things run very slow v1.0.4
const STYLE_MODEL_PATH = require('./ai-models/saved_model_style_js/model.json')
const TRANSFORM_MODEL_PATH = require('./ai-models/saved_model_transformer_separable_js/model.json')

var requireAI = require.context('./ai-models', true, /./);
requireAI.keys().forEach(requireAI);

AFRAME.registerSystem('ai', {
  init() {
  },
  async loadModels() {
    if (this.loadingModels) return await this.loadingModels

    this.loadingModels = (async () => {
      console.log("initializing ai")
      this.styleNet = await tf.loadGraphModel(STYLE_MODEL_PATH);
      this.transformNet = await tf.loadGraphModel(TRANSFORM_MODEL_PATH)
    })()

    return await this.loadingModels
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
