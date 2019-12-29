AFRAME.registerComponent('layer-preview', {
  schema: {
    compositor: {type: 'selector'},
    layer: {type: 'int'}
  },

  init() {
  },
  tick() {
    if (!this.canvased && this.data.compositor)
    {
      var cEl = this.data.compositor;
      console.log(cEl, cEl.components, cEl.components['compositor'])

      let layer = cEl.components.compositor.layers[this.data.layer]
      this.el.setAttribute('material', {src: layer.canvas})
      this.canvased = true
    }
  },
  update() {
    this.canvased = false
  }
})
