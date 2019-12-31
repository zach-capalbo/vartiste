const layerShelfHTML = require('./partials/layer-view.html.slm')

AFRAME.registerComponent("layer-shelves", {
  schema: {compositor: {type: 'selector'}},
  init() {
    this.built = false
    this.shelves = {}
    this.onLayerChanged = this.onLayerChanged.bind(this)
  },
  update(oldData) {
    if (oldData.compositor)
    {
      oldData.compositor.removeEventListener('activelayerchanged', this.onLayerChanged)
    }

    this.data.compositor.addEventListener('activelayerchanged', this.onLayerChanged)
  },
  addLayerShelf(layer, layerIdx) {
    console.log("Adding shelf for", layer, layerIdx)
    var container = document.createElement('a-entity')
    container.innerHTML = layerShelfHTML
    this.el.prepend(container)
    container.addEventListener('click', (e) => {
      console.log("Clicked", e.target.getAttribute("click-action"))
      this[e.target.getAttribute("click-action") + 'Layer'](layer, layerIdx, e)
    })
    container.setAttribute('position', {x: 0, y: layerIdx, z: 0})
    container.setAttribute('scale', {x: 0.3, y: 0.3, z: 1})
    container.querySelector('*[canvas-updater]').setAttribute('layer-preview', AFRAME.utils.styleParser.stringify({compositor: `#${this.data.compositor.id}`, layer: layerIdx}))
    this.shelves[layer.id] = container

    if (layer.active) {
      container.querySelector('.active-indicator').setAttribute('visible', "true")
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
  hideLayer(layer, layerIdx) {
    layer.visible = !layer.visible
  },
  editLayer(layer, layerIdx) {
    this.compositor.activateLayer(layer)
  },
  newLayer(layer, layerIdx) {
    // Temp until I get re-ordering working
    layerIdx = this.compositor.layers.length - 1

    this.addLayerShelf(this.compositor.addLayer(layerIdx), parseInt(layerIdx) + 1)
  },
  onLayerChanged(e) {
    let {layer, oldLayer} = e.detail
    console.log("Activating layer", layer)
    if (oldLayer && oldLayer.id in this.shelves) {
      this.shelves[oldLayer.id].querySelector('.active-indicator').setAttribute('visible', "false")
    }
    if (layer && layer.id in this.shelves)
    {
      this.shelves[layer.id].querySelector('.active-indicator').setAttribute('visible', "true")
    }
  }
})
