const layerShelfHTML = require('./partials/layer-view.html.slm')
const modeSelectionHTML = require('./partials/mode-shelf.html.slm')

const {LAYER_MODES} = require('./layer-modes.js')

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

    this.modePopup = document.createElement('a-entity')
    this.modePopup.innerHTML = modeSelectionHTML
    this.modePopup.setAttribute('position', "0 -999999 0")
    this.modePopup.setAttribute('scale', "0.3 0.3 0.3")
    this.modePopup.setAttribute('visible', false)
    this.el.append(this.modePopup)

    this.modePopup.addEventListener('click', e => this.handleModeSelection(e))
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

    container.innerHTML = layerShelfHTML
    container.addEventListener('click', (e) => {
      if (!e.target.hasAttribute('click-action')) return

      console.log("Clicked", e.target.getAttribute("click-action"))
      this[e.target.getAttribute("click-action") + 'Layer'](layer, e)
    })
    container.setAttribute('position', {x: 0, y: layerIdx, z: 0})
    container.setAttribute('scale', {x: 0.3, y: 0.3, z: 1})
    container.querySelector('*[canvas-updater]').setAttribute('layer-preview', AFRAME.utils.styleParser.stringify({compositor: `#${this.data.compositor.id}`, layer: layer.id}))
    container.querySelector('*[shelf]')['redirect-grab'] = this.el

    if (layer.active) {
      container.querySelector('.active-indicator').setAttribute('visible', "true")
    }

    this.shelves[layer.id] = container

    container.addEventListener('loaded', e => this.compositor_layerupdated({detail: {layer}}))

    this.el.prepend(container)
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
  duplicateLayer(layer) {
    this.compositor.duplicateLayer(layer)
    this.shuffle()
  },
  toggleModeLayer(layer) {
    this.modePopup.setAttribute('visible', true)
    this.modePopup.setAttribute('position', `0 ${this.shelves[layer.id].getAttribute('position').y} 0.3`)
    this.modePopup.activeLayer = layer
  },
  moveUpLayer(layer) {
    let layerIdx = this.compositor.layers.indexOf(layer)
    let nextLayer = this.compositor.layers[(layerIdx + 1) % this.compositor.layers.length]
    this.compositor.swapLayers(layer, nextLayer)
  },
  moveDownLayer(layer) {
    let layerIdx = this.compositor.layers.indexOf(layer)
    let nextLayerIdx = layerIdx - 1
    if (nextLayerIdx < 0) nextLayerIdx += this.compositor.layers.length
    this.compositor.swapLayers(layer, this.compositor.layers[nextLayerIdx])
  },
  mergeDownLayer(layer) {
    let layerIdx = this.compositor.layers.indexOf(layer)
    let nextLayerIdx = layerIdx - 1
    if (nextLayerIdx < 0) nextLayerIdx += this.compositor.layers.length
    this.compositor.mergeLayers(layer, this.compositor.layers[nextLayerIdx])
  },
  grabLayer(layer) {
    this.compositor.grabLayer(layer)
  },
  handleModeSelection(e) {

    if (!this.modePopup.activeLayer) return

    if (e.target.hasAttribute('layer-mode'))
    {
      let selection = e.target.getAttribute('layer-mode')
      this.compositor.setLayerBlendMode(this.modePopup.activeLayer, selection)
    }

    if (e.target.hasAttribute('layer-mode') || e.target.getAttribute('click-action') === 'close-mode')
    {
      this.modePopup.setAttribute('visible', false)
      this.modePopup.setAttribute('position', "0 -999999 0")
      this.el.sceneEl.emit('refreshobjects')
    }
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

    if (layer.id in this.shelves)
    {
      let shelf = this.shelves[layer.id]
      delete this.shelves[layer.id]
      this.el.removeChild(shelf)
    }

    this.shuffle()
    console.log("Full deleted")
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

    if (!(layer.id in this.shelves)) return;
    if (!this.shelves[layer.id].hasLoaded) return

    try {
      if (this.shelves[layer.id].querySelector('.mode-text').hasLoaded)
      {
        this.shelves[layer.id].querySelector('.mode-text').setAttribute('text', {value: `Mode: ${layer.mode}`})
      }
    } catch (e) {console.error("No text for", this.shelves[layer.id])}

    this.shelves[layer.id].querySelector('.active-indicator').setAttribute('visible', layer.active && !layer.grabbed)
    this.shelves[layer.id].querySelector('.grabbing-indicator').setAttribute('visible', layer.grabbed)
    this.shelves[layer.id].querySelector('*[opacity-picker]').components['opacity-picker'].layer = layer
    this.shelves[layer.id].querySelector('*[opacity-picker]').components['opacity-picker'].adjustIndicator(layer.opacity)
  },
  compositor_layersmoved(e) {
    console.log("Layers moved")
    this.shuffle()
  }
})
