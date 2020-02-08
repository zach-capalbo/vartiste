AFRAME.registerComponent('hand-draw-tool', {
  dependencies: ['raycaster'],
  schema: {
    throttle: {type: 'int', default: 10}
  },
  pool(name, type) {
    if (this._pool[name]) return this._pool[name]
    this._pool[name] = new type()
    return this._pool[name]
  },
  init() {
    this._pool = {}
    this.system = this.el.sceneEl.systems['paint-system']
    this.intersects = []
    this.clickStamp = 0
    this.distanceScale = 1.0
    this.el.addEventListener('triggerchanged', (e) => {
      let threshold = 0.1
      this.pressure = (0 + e.detail.value - threshold)  / (1 - threshold)
      let wasDrawing = this.isDrawing
      this.isDrawing = this.pressure > 0.1

      if (this.isDrawing && !wasDrawing) {
        this.startDraw()
      }
      if (!this.isDrawing && wasDrawing) {
        this.endDraw()
      }
    })

    if (this.el.hasAttribute('cursor'))
    {
      document.addEventListener('mousedown', e => {
        if (!e.buttons || e.buttons == 1) return
        this.pressure = 1.0
        this.isDrawing = true
        this.startDraw()
      })

      document.addEventListener('mouseup', e=> {
        if (e.button == 0) return
        if (this.isDrawing) {
          this.isDrawing = false
          this.endDraw()
        }
      })

      document.addEventListener('wheel', e => {
        this.el.sceneEl.systems['paint-system'].scaleBrush(-e.deltaY * ((e.deltaY > 50 || e.deltaY < -50) ? 1 : 100))
      })
    }

    this._tick = this.tick
    this.tick = AFRAME.utils.throttleTick(this.tick, this.data.throttle, this)
  },
  startDraw() {
    console.log("Start drawing")
    this.el.emit('startdrawing')
  },
  endDraw() {
    console.log("End drawing")
    this.el.emit('enddrawing')
    this.lastParams = undefined
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

    let params = {pressure: this.pressure, rotation: rotation, sourceEl: this.el, distance: intersection.distance, scale: this.distanceScale, intersection: intersection}

    if (this.isDrawing && !this.el.is("erasing")) {
      if (isDrawable)
      {
        drawCanvas.drawUV(intersection.uv, Object.assign({lastParams: this.lastParams}, params))
        this.lastParams = params
        this.lastParams.uv = intersection.uv
      }
      else
      {
        // console.log("emitting draw to", el, intersection)
        el.emit("draw", params)
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
        drawCanvas.eraseUV(intersection.uv, params)
      }
    }
  }
})
