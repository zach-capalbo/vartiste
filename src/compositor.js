import {Layer} from "./layer.js"

AFRAME.registerComponent('compositor', {
  schema: {
    width: {default: 1024},
    height: {default: 512},
    baseWidth: {default: 1024},
    geometryWidth: {default: 80}
  },

  init() {
    let {width, height} = this.data
    this.width = width
    this.height = height

    let compositeCanvas = document.createElement("canvas")
    compositeCanvas.width = width
    compositeCanvas.height = height
    document.body.append(compositeCanvas)
    this.compositeCanvas = compositeCanvas

    this.el.setAttribute('material', {src: compositeCanvas})

    this.layers = [new Layer(this.width, this.height), new Layer(this.width, this.height)]
    this.activeLayer = this.layers[0]

    let bgCtx = this.activeLayer.canvas.getContext('2d')
    bgCtx.fillStyle = "#FFF"
    bgCtx.fillRect(0,0,this.width,this.height)

    this.activateLayer(this.layers[1])

    let overlayCanvas = document.createElement("canvas")
    overlayCanvas.width = this.width
    overlayCanvas.height = this.height
    document.body.append(overlayCanvas)
    this.overlayCanvas = overlayCanvas;

    this.el.setAttribute("draw-canvas", {canvas: this.layers[0].canvas})
    this.activateLayer(this.activeLayer)

    this.redirector = this.el.querySelector('#move-layer-redirection')
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
    this.el.components['draw-canvas'].transform = layer.transform
    layer.active = true
    this.activeLayer = layer

    if (this.layers.indexOf(oldLayer) >= 0)
    {
      this.el.emit('layerupdated', {layer: oldLayer})
    }

    if (this.layers.indexOf(layer) >= 0)
    {
      this.el.emit('layerupdated', {layer})
    }
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

    console.log("Deleting layer", layer.id, idx)
    if (idx < 0) throw new Error("Cannot find layer to delete", layer)
    this.layers.splice(idx, 1)
    if (this.layers.length == 0)
    {
      this.addLayer(0)
    }
    if (layer.active && this.layers.length > 0)
    {
      this.activateLayer(this.layers[idx % this.layers.length])
    }

    this.el.emit('layerdeleted', {layer})
  },
  setLayerBlendMode(layer,mode) {
    layer.mode = mode
    this.el.emit('layerupdated', {layer})
  },
  grabLayer(layer) {
    if (this.grabbedLayer == layer)
    {
      this.el['redirect-grab'] = undefined
      this.grabbedLayer.grabbed = false
      this.grabbedLayer = undefined
      this.el.emit('layerupdated', {layer})
      return
    }

    if (this.grabbedLayer)
    {
      this.grabbedLayer.grabbed = false
      this.el.emit('layerupdated', {layer: this.grabbedLayer})
    }

    this.redirector.object3D.position.set(
      layer.transform.translation.x / this.width * this.el.components.geometry.data.width,
      -layer.transform.translation.y / this.height * this.el.components.geometry.data.height,
      0)
    this.redirector.object3D.scale.set(layer.transform.scale.x, layer.transform.scale.y, 1)
    this.el['redirect-grab'] = this.redirector
    layer.grabbed = true
    this.grabbedLayer = layer
    this.el.emit('layerupdated', {layer})
  },
  drawOverlay(ctx) {
    ctx.save()
    const {width, height} = this

    this.el.components['draw-canvas'].transform = Layer.EmptyTransform()

    let overlayCtx = this.overlayCanvas.getContext('2d')
    overlayCtx.clearRect(0, 0, width, height)

    for (let hand of ['right-hand', 'left-hand'])
    {
      let intersection = document.getElementById(hand).components.raycaster.getIntersection(this.el)

      if (!intersection) continue

      this.el.components['draw-canvas'].drawOutlineUV(overlayCtx, intersection.uv)
    }

    ctx.globalCompositeOperation = 'difference'
    ctx.drawImage(this.overlayCanvas, 0, 0)
    ctx.restore()
  },
  tick() {
    if (this.el['redirect-grab'])
    {
      let layer = this.grabbedLayer
      layer.transform.translation.x = this.redirector.object3D.position.x / this.el.components.geometry.data.width * this.width
      layer.transform.translation.y = -this.redirector.object3D.position.y / this.el.components.geometry.data.height * this.height
      layer.transform.scale.x = this.redirector.object3D.scale.x
      layer.transform.scale.y = this.redirector.object3D.scale.y
    }

    let ctx = this.compositeCanvas.getContext('2d')
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

    this.drawOverlay(ctx)

    this.el.components['draw-canvas'].transform = this.activeLayer.transform
  },
  // clear() {
  //   this.el.emit
  // },
  save() {
    let layers = this.layers

    return {
      layers,
      canvases: layers.map(l => l.canvas.toDataURL())
    }
  },
  async load(obj) {
    console.log("Loading project")

    let delay = () => new Promise(r => setTimeout(r, 100))

    for (let layer of this.layers) {
      console.log("Deleting", layer)
      this.deleteLayer(layer)
      await delay()
    }

    for (let i = 0; i < obj.layers.length; ++i)
    {
      let layerObj = obj.layers[i]
      let canvasData = obj.canvases[i]

      let layer = new Layer(layerObj.width, layerObj.height)
      let canvas = layer.canvas
      Object.assign(layer, layerObj)
      layer.canvas = canvas

      let img = new Image
      img.src = canvasData
      await delay()
      console.log("Loaded Layer", layer, img, img.complete)
      await delay()
      layer.canvas.getContext('2d').drawImage(img, 0, 0)
      await delay()

      this.layers.push(layer)
      this.el.emit('layeradded', {layer})
      await delay()
      this.el.emit('layerupdated', {layer})
      await delay()
    }

    this.deleteLayer(this.layers[0])

    this.activateLayer(this.layers.find(l => l.active))
    console.log("Fully loaded")
  },
  resize(width, height)
  {
    let oldWidth = this.width
    let oldHeight = this.height

    this.width = width
    this.height = height

    this.compositeCanvas.width = width
    this.compositeCanvas.height = height

    this.overlayCanvas.width = this.width
    this.overlayCanvas.height = this.height

    for (let layer of this.layers)
    {
      layer.resize(width, height)
    }

    if (this.el.components['geometry'])
    {
      let gWidth = this.width / this.data.baseWidth * this.data.geometryWidth
      let gHeight = this.height / this.data.baseWidth * this.data.geometryWidth
      console.log(gWidth, gHeight)
      this.el.setAttribute('geometry', {primitive: 'plane', width: gWidth, height: gHeight})
    }

    for (let layer of this.layers)
    {
      this.el.emit('layerupdated', {layer})
    }
  }
})
