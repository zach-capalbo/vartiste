AFRAME.registerComponent('hand-draw-tool', {
  dependencies: ['raycaster', 'laser-controls'],
  init() {
    this.system = this.el.sceneEl.systems['paint-system']
    this.intersects = []
    this.clickStamp = 0
    let threshold = 0.1
    this.el.addEventListener('triggerchanged', (e) => {
      this.pressure = (0 + e.detail.value - threshold)  / (1 - threshold)
      this.isDrawing = this.pressure > 0.1
    })
  },
  tick() {
    if (this.el.components.raycaster.intersections.length == 0) return

    let intersection = this.el.components.raycaster.intersections.sort(i => - i.distance)[0]
    let el = intersection.object.el
    let rotation = - this.el.object3D.rotation.z
    if (!this.system.data.rotateBrush) rotation = 0
    if (this.isDrawing) {
      if ('draw-canvas' in el.components)
      {
        el.components['draw-canvas'].drawUV(intersection.uv, {pressure: this.pressure, rotation: rotation})
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
