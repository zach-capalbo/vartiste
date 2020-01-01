const layerShelfHTML = require('./partials/layer-view.html.slm')

const LAYER_MODES = [
  "source-over",


  "screen",
  "overlay",
  // "darken",
  // "lighten",
  "color-dodge",
  "color-burn",
  // "soft-light",
  // "hard-light",

  // "multiply",
  // "difference",

  // "hue",
  // "saturation",
  "color",
  // "luminosity",

  "source-atop",
  "source-in"
]

AFRAME.registerComponent("layer-shelves", {
  schema: {compositor: {type: 'selector'}},
  init() {
    this.built = false
    this.shelves = {}
    this.compositorEvents = Object.getOwnPropertyNames(Object.getPrototypeOf(this)).filter(k => k.startsWith("compositor_")).map(k => k.slice("compositor_".length))
    for (let e of this.compositorEvents)
    {
      this['compositor_' + e] = this['compositor_' + e].bind(this)
    }
  },
  update(oldData) {

    if (oldData.compositor)
    {
      for (let e of this.compositorEvents)
      {
        oldData.compositor.removeEventListener(e, this['compositor_' + e])
      }
    }

    for (let e of this.compositorEvents)
    {
      this.data.compositor.addEventListener(e, this['compositor_' + e])
    }
  },
  addLayerShelf(layer) {
    let layerIdx = this.compositor.layers.indexOf(layer)
    console.log("Adding shelf for", layer, layerIdx)
    var container = document.createElement('a-entity')
    this.shelves[layer.id] = container
    container.innerHTML = layerShelfHTML
    this.el.prepend(container)
    container.addEventListener('click', (e) => {
      console.log("Clicked", e.target.getAttribute("click-action"))
      this[e.target.getAttribute("click-action") + 'Layer'](layer, e)
    })
    container.setAttribute('position', {x: 0, y: layerIdx, z: 0})
    container.setAttribute('scale', {x: 0.3, y: 0.3, z: 1})
    container.querySelector('*[canvas-updater]').setAttribute('layer-preview', AFRAME.utils.styleParser.stringify({compositor: `#${this.data.compositor.id}`, layer: layerIdx}))
    container.querySelector('*[shelf]')['redirect-grab'] = this.el

    if (layer.active) {
      container.querySelector('.active-indicator').setAttribute('visible', "true")
    }
  },
  shuffle() {
    for (let id in this.shelves)
    {
      let layerIdx = this.compositor.layers.findIndex(l => l.id == id)
      this.shelves[id].setAttribute('position', {y: layerIdx})
    }
  },
  tick(t, dt) {
    if (!this.built && this.data.compositor.components.compositor) {
      console.log(this.data.compositor, this.data.compositor.components.compositor)
      this.compositor = this.data.compositor.components.compositor

      for (let layerIdx in this.compositor.layers)
      {
        let layer = this.compositor.layers[layerIdx]
        this.addLayerShelf(layer, layerIdx)
      }
      this.tick = function() {}
    }
  },
  hideLayer(layer) {
    layer.visible = !layer.visible
  },
  editLayer(layer) {
    this.compositor.activateLayer(layer)
  },
  deleteLayer(layer) {
    this.compositor.deleteLayer(layer)
  },
  newLayer(layer) {
    let layerIdx = this.compositor.layers.indexOf(layer)
    this.compositor.addLayer(layerIdx)
    this.shuffle()
  },
  toggleModeLayer(layer) {
    let modeIdx = (LAYER_MODES.indexOf(layer.mode) + 1) % LAYER_MODES.length
    this.compositor.setLayerBlendMode(layer, LAYER_MODES[modeIdx])
  },
  moveUpLayer(layer) {
    let layerIdx = this.compositor.layers.indexOf(layer)
    let nextLayer = this.compositor.layers[(layerIdx + 1) % this.compositor.layers.length]
    this.compositor.swapLayers(layer, nextLayer)
  },
  moveDownLayer(layer) {
    let layerIdx = this.compositor.layers.indexOf(layer)
    let nextLayerIdx = layerIdx -1
    if (nextLayerIdx < 0) nextLayerIdx += this.compositor.layers.length
    this.compositor.swapLayers(layer, this.compositor.layers[nextLayerIdx])
  },
  compositor_activelayerchanged(e) {
    let {layer, oldLayer} = e.detail
    console.log("Activating layer", layer)
    if (oldLayer && oldLayer.id in this.shelves) {
      this.shelves[oldLayer.id].querySelector('.active-indicator').setAttribute('visible', "false")
    }
    if (layer && layer.id in this.shelves)
    {
      this.shelves[layer.id].querySelector('.active-indicator').setAttribute('visible', "true")
    }
  },
  compositor_layerdeleted(e) {
    let {layer} = e.detail
    this.el.removeChild(this.shelves[layer.id])
    delete this.shelves[layer.id]
    this.shuffle()
  },
  compositor_layeradded(e) {
    let {layer} = e.detail
    if (!(layer.id in this.shelves))
    {
      this.addLayerShelf(layer)
    }
    this.shuffle()
  },
  compositor_layerupdated(e) {
    let {layer} = e.detail
    this.shelves[layer.id].querySelector('.mode-text').setAttribute('text', {value: `Mode: ${layer.mode}`})
  },
  compositor_layersmoved(e) {
    this.shuffle()
  }
})
