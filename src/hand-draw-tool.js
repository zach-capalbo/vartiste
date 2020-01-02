AFRAME.registerComponent('hand-draw-tool', {
  dependencies: ['raycaster', 'laser-controls'],
  init() {
    this.system = this.el.sceneEl.systems['paint-system']
    this.intersects = []
    this.clickStamp = 0
    this.el.addEventListener('triggerchanged', (e) => {
      this.pressure = 0 + e.detail.value

      if (this.isDrawing && !e.detail.pressed)
      {
        if (e.timeStamp - this.clickStamp > 100)
        {

          // TODO use intersectedEls of raycaster
          for (let el of this.intersects)
          {
            let intersection = this.el.components.raycaster.getIntersection(el)

            if (!intersection) continue;

            // el.emit("click", Object.assign({intersection}, e.detail), true)
          }
          this.clickStamp = e.timeStamp
        }
      }
      this.isDrawing = e.detail.pressed
    })
    this.el.addEventListener('raycaster-intersection', (e) => {
      for (let el of e.detail.els) {
        if (this.intersects.indexOf(el) < 0)
        {
          this.intersects.push(el)
        }
      }
    })
    this.el.addEventListener('raycaster-intersection-cleared', (e) => {
      this.intersects.splice(this.intersects.indexOf(e.el, 1))
    })
  },
  tick() {
    if (this.el.components.raycaster.intersections.length == 0) return

    let intersection = this.el.components.raycaster.intersections.sort(i => - i.distance)[0]
    let el = intersection.object.el
    if (this.isDrawing) {

      {
        // let intersection = this.el.components.raycaster.getIntersection(el)

        // if (!intersection) continue;

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
    if (this.el.is("sampling"))
    {
      // for (var el of this.intersects)
      {
        // let intersection = this.el.components.raycaster.getIntersection(el)

        if ('draw-canvas' in el.components)
        {
          this.system.selectColor(el.components['draw-canvas'].pickColorUV(intersection.uv))
        }
      }
    }
    if (this.el.is("erasing"))
    {
      // for (var el of this.intersects)
      {
        // let intersection = this.el.components.raycaster.getIntersection(el)

        if ('draw-canvas' in el.components)
        {
          el.components['draw-canvas'].eraseUV(intersection.uv)
        }
      }
    }
  }
})
