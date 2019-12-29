const layerShelfHTML = require('./partials/layer-view.html.slm')

AFRAME.registerComponent("layer-shelves", {
  schema: {compositor: {type: 'selector'}},
  init() {
    this.built = false
  },
  addLayerShelf(layer, layerIdx) {
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
    this.data.compositor.setAttribute('draw-canvas', {canvas: layer.canvas})
  }
})
