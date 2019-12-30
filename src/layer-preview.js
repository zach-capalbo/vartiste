AFRAME.registerComponent('layer-preview', {
  schema: {
    compositor: {type: 'selector'},
    layer: {type: 'int', default: '-1'}
  },

  init() {
  },
  tick() {
    if (!this.canvased && this.data.compositor && this.data.layer >= 0)
    {
      var cEl = this.data.compositor;
      console.log(this.data.layer, cEl, cEl.components, cEl.components['compositor'])


      let layer = cEl.components.compositor.layers[this.data.layer]
      this.el.setAttribute('material', {src: layer.canvas})
      this.canvased = true
    }
  },
  update() {
    this.canvased = false
  }
})
