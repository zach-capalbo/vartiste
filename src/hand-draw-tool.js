AFRAME.registerComponent('hand-draw-tool', {
  dependencies: ['raycaster', 'laser-controls'],
  init() {
    this.intersects = []
    this.el.addEventListener('triggerchanged', (e) => {
      this.isDrawing = e.detail.pressed
      this.pressure = 0 + e.detail.value
    })
    this.el.addEventListener('raycaster-intersection', (e) => {
      this.intersects.push(e.detail.els[0])
    })
    this.el.addEventListener('raycaster-intersection-cleared', (e) => {
      this.intersects.splice(this.intersects.indexOf(e.el, 1))
    })
  },
  tick() {
    if (this.isDrawing) {
      for (var el of this.intersects)
      {
        let intersection = this.el.components.raycaster.getIntersection(el)

        if ('draw-canvas' in el.components)
        {
          el.components['draw-canvas'].drawUV(intersection.uv, {pressure: this.pressure})
        }
        else
        {
          el.emit("draw", {intersection, pressure:this.pressure})
        }
      }
    }
  }
})
