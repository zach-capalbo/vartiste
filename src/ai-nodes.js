import {Node, CanvasNode} from './layer.js'
import * as tf from '@tensorflow/tfjs';
tf.ENV.set('WEBGL_PACK', false);  // This needs to be done otherwise things run very slow v1.0.4
const STYLE_MODEL_PATH = require('./ai-models/saved_model_style_js/model.json')
const TRANSFORM_MODEL_PATH = require('./ai-models/saved_model_transformer_separable_js/model.json')

var requireAI = require.context('./ai-models', true, /./);
requireAI.keys().forEach(requireAI);

// require('./ai-models/saved_model_style_js/group1-shard1of3')
// require('./ai-models/saved_model_style_js/group1-shard2of3')
// require('./ai-models/saved_model_style_js/group1-shard3of3')
// require('./ai-models/saved_model_transformer_separable_js/group1-shard1of1')

AFRAME.registerSystem('ai', {
  init() {
    this.loadModels()
  },
  async loadModels() {
    console.log("initializing ai")

    this.styleNet = await tf.loadGraphModel(STYLE_MODEL_PATH);
    this.transformNet = await tf.loadGraphModel(TRANSFORM_MODEL_PATH)
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

    if (this.data.isRunningInference) return
    this.updateTime = document.querySelector('a-scene').time

    await this.runInference()

  }
  async runInference() {
    this.data.isRunningInference = true
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
    this.data.isRunningInference = false
  }
}
