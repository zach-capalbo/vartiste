AFRAME.registerComponent('hand-draw-tool', {
  dependencies: ['raycaster', 'laser-controls'],
  schema: {
    throttle: {type: 'int', default: 10}
  },
  init() {
    this.system = this.el.sceneEl.systems['paint-system']
    this.intersects = []
    this.clickStamp = 0
    this.el.addEventListener('triggerchanged', (e) => {
      let threshold = 0.1
      this.pressure = (0 + e.detail.value - threshold)  / (1 - threshold)
      let wasDrawing = this.isDrawing
      this.isDrawing = this.pressure > 0.1

      if (this.isDrawing && !wasDrawing) {
        console.log("Start drawing")
        this.el.emit('startdrawing')
      }
      if (!this.isDrawing && wasDrawing) {
        console.log("End drawing")
        this.el.emit('enddrawing')
      }
    })

    this._tick = this.tick
    this.tick = AFRAME.utils.throttleTick(this.tick, this.data.throttle, this)
  },
  tick() {
    if (this.el.components.raycaster.intersections.length == 0) return

    let intersection = this.el.components.raycaster.intersections.sort(i => navigator.xr ? i.distance : - i.distance)[0]
    let el = intersection.object.el

    let isDrawable = false
    let drawCanvas
    if ('draw-canvas' in el.components)
    {
      isDrawable = true
      drawCanvas = el.components['draw-canvas']
    }
    else if ('forward-draw' in el.components)
    {
      isDrawable = true
      drawCanvas = el.components['forward-draw']
    }

    let rotation = 0

    if (this.system.data.rotateBrush)
    {
      let rotationEuler = this.rotationEuler || new THREE.Euler()
      this.rotationEuler = rotationEuler
      rotationEuler.copy(this.el.object3D.rotation)
      rotationEuler.reorder("ZYX")
      rotation = - rotationEuler.z
    }

    if (this.isDrawing) {
      if (isDrawable)
      {
        drawCanvas.drawUV(intersection.uv, {pressure: this.pressure, rotation: rotation, sourceEl: this.el})
      }
      else
      {
        console.log("emitting draw to", el, intersection)
        el.emit("draw", {intersection, pressure:this.pressure})
      }
    }
    if (this.el.is("sampling"))
    {
      if (isDrawable)
      {
        this.system.selectColor(drawCanvas.pickColorUV(intersection.uv))
      }
    }
    if (this.el.is("erasing"))
    {
      if (isDrawable)
      {
        drawCanvas.eraseUV(intersection.uv, {rotation, sourceEl: this.el})
      }
    }
  }
})
