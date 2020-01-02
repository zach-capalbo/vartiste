AFRAME.registerComponent('layer-preview', {
  schema: {
    compositor: {type: 'selector'},
    layer: {default: ""}
  },

  init() {
  },
  tick() {
    if (!this.canvased && this.data.compositor && this.data.layer.length >= 0)
    {
      var cEl = this.data.compositor;
      console.log(this.data.layer, cEl, cEl.components, cEl.components['compositor'])


      let layer = cEl.components.compositor.layers.find(l => l.id == this.data.layer)
      this.el.setAttribute('material', {src: layer.canvas})
      this.canvased = true

      cEl.addEventListener('layerdeleted', e => {
        let {layer} = e.detail
        if (layer.id == this.data.layer)
        {
          this.el.setAttribute('material', {src: ""})
        }
      })
    }
  },
  update() {
    this.canvased = false
  }
})
