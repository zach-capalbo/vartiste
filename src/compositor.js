import {Layer} from "./layer.js"

AFRAME.registerComponent('compositor', {
  schema: {canvas: {type: 'selector'}},

  init() {
    this.width = this.data.canvas.width
    this.height = this.data.canvas.height

    this.layers = [new Layer(this.width, this.height), new Layer(this.width, this.height)]
    this.activeLayer = this.layers[0]

    let bgCtx = this.activeLayer.canvas.getContext('2d')
    bgCtx.fillStyle = "#FFF"
    bgCtx.fillRect(0,0,this.width,this.height)


    let overlayCanvas = document.createElement("canvas")
    overlayCanvas.width = this.width
    overlayCanvas.height = this.height
    document.body.append(overlayCanvas)
    this.overlayCanvas = overlayCanvas;

    this.el.setAttribute("draw-canvas", {canvas: this.layers[0].canvas})
    this.activateLayer(this.activeLayer)
    // this.el.components['draw-canvas'].data.canvas = this.layers[0].canvas
  },

  addLayer(position) {
    let layer = new Layer(this.width, this.height)
    this.layers.splice(position + 1, 0, layer)
    this.el.emit('layeradded', {layer})
    this.activateLayer(layer)
  },

  activateLayer(layer) {
    this.activeLayer.active = false
    let oldLayer = this.activeLayer
    this.el.setAttribute('draw-canvas', {canvas: layer.canvas})
    layer.active = true
    this.activeLayer = layer
    this.el.emit('activelayerchanged', {layer, oldLayer})
  },

  nextLayer() {
    let idx = this.layers.indexOf(this.activeLayer)
    this.activateLayer(this.layers[(idx + 1) % this.layers.length])
  },

  prevLayer() {
    let idx = this.layers.indexOf(this.activeLayer) - 1
    if (idx < 0) idx += this.layers.length
    this.activateLayer(this.layers[idx])
  },
  swapLayers(layer1, layer2) {
    let idx1 = this.layers.indexOf(layer1)
    let idx2 = this.layers.indexOf(layer2)
    this.layers[idx1] = layer2
    this.layers[idx2] = layer1
    this.el.emit('layersmoved', {layers: [layer1,layer2]})
  },
  deleteLayer(layer) {
    let idx = this.layers.indexOf(layer)
    if (idx < 0) throw new Error("Cannot find layer to delete", layer)
    this.layers.splice(idx, 1)
    if (this.layers.length == 0)
    {
      this.addLayer(0)
    }
    if (layer.active)
    {
      this.activateLayer(this.layers[idx % this.layers.length])
    }

    this.el.emit('layerdeleted', {layer})
  },
  setLayerBlendMode(layer,mode) {
    layer.mode = mode
    this.el.emit('layerupdated', {layer})
  },
  tick() {
    let ctx = this.data.canvas.getContext('2d')
    // ctx.fillStyle = "#FFFFFF"
    ctx.clearRect(0,0, this.width, this.height)

    const width = this.width
    const height = this.height

    for (let layer of this.layers) {
      if (layer.visible)
      {
        layer.draw(ctx)
      }
    }

    ctx.save()

    let overlayCtx = this.overlayCanvas.getContext('2d')
    overlayCtx.clearRect(0, 0, width, height)

    for (let hand of ['right-hand', 'left-hand'])
    {
      let intersection = document.getElementById(hand).components.raycaster.getIntersection(this.el)

      if (!intersection) continue

      // let x = width * intersection.uv.x
      // let y = height * (1 - intersection.uv.y)
      // this.el.components['draw-canvas'].brush.drawOutline(overlayCtx, x, y)
      this.el.components['draw-canvas'].drawOutlineUV(overlayCtx, intersection.uv)
    }

    ctx.globalCompositeOperation = 'difference'
    ctx.drawImage(this.overlayCanvas, 0, 0)
    ctx.restore()
  }
})
