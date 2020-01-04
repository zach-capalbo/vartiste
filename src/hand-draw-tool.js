AFRAME.registerComponent('hand-draw-tool', {
  dependencies: ['raycaster', 'laser-controls'],
  init() {
    this.system = this.el.sceneEl.systems['paint-system']
    this.intersects = []
    this.clickStamp = 0
    this.el.addEventListener('triggerchanged', (e) => {
      this.pressure = 0 + e.detail.value
      this.isDrawing = e.detail.pressed
    })
  },
  tick() {
    if (this.el.components.raycaster.intersections.length == 0) return

    let intersection = this.el.components.raycaster.intersections.sort(i => - i.distance)[0]
    let el = intersection.object.el
    if (this.isDrawing) {
      if ('draw-canvas' in el.components)
      {
        el.components['draw-canvas'].drawUV(intersection.uv, {pressure: this.pressure})
      }
      else
      {
        console.log("emitting draw to", el, intersection)
        el.emit("draw", {intersection, pressure:this.pressure})
      }
    }
    if (this.el.is("sampling"))
    {
      {
        if ('draw-canvas' in el.components)
        {
          this.system.selectColor(el.components['draw-canvas'].pickColorUV(intersection.uv))
        }
      }
    }
    if (this.el.is("erasing"))
    {
      if ('draw-canvas' in el.components)
      {
        el.components['draw-canvas'].eraseUV(intersection.uv)
      }
    }
  }
})
