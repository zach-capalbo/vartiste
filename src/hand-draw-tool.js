import {Pool} from './pool.js'
import {Sfx} from './sfx.js'
import shortid from 'shortid'

// Allows drawing to a [`draw-canvas`](#draw-canvas) via a raycaster.
//
// *Note,* this uses the [`paint-system`](#paint-system) to set information
// about the brush, color, opacity, etc
AFRAME.registerComponent('hand-draw-tool', {
  dependencies: ['raycaster'],
  schema: {
    throttle: {type: 'int', default: 10}
  },
  init() {
    Pool.init(this)
    this.system = this.el.sceneEl.systems['paint-system']
    this.intersects = []
    this.clickStamp = 0
    this.distanceScale = 1.0
    this.id = shortid.generate()
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
        if (e.button !== 0) return
        if (e.shiftKey) return
        if (this.el.is('looking')) return
        this.pressure = 1.0
        this.isDrawing = true
        this.startDraw()
      })

      document.addEventListener('mouseup', e=> {
        if (e.button !== 0) return
        if (this.el.is('looking')) return
        if (this.isDrawing) {
          this.isDrawing = false
          this.endDraw()
        }
      })

      document.addEventListener('touchstart', e => {
        if (e.touches.length !== 1) return
        if (e.shiftKey) return
        if (this.el.is('looking')) return
        this.pressure = 1.0
        this.isDrawing = true
        this.startDraw()
      })

      document.addEventListener('touchend', e => {
        if (this.el.is('looking')) return
        if (this.isDrawing) {
          this.isDrawing = false
          this.endDraw()
        }
      })

      document.addEventListener('wheel', e => {
        if (e.shiftKey) return
        this.el.sceneEl.systems['paint-system'].scaleBrush(-e.deltaY * ((e.deltaY > 50 || e.deltaY < -50) ? 1 : 100))
      })
    }

    this._tick = this.tick
    this.tick = AFRAME.utils.throttleTick(this.tick, this.data.throttle, this)
    this.params = {pressure: 0.0, rotation: 0.0, sourceEl: this.el, distance: 0.0, scale: 1.0, intersection: null, brush: this.system.brush}
    this.lastParams = Object.assign({}, this.params)
  },
  startDraw() {
    //console.log("Start drawing")
    this.el.emit('startdrawing')
  },
  endDraw() {
    //console.log("End drawing")
    this.el.emit('enddrawing')
    this.lastParams.active = false
  },
  tick() {
    if (this.lastCompositor) delete this.lastCompositor.components.compositor.overlays[this.id]
    if (this.el.components.raycaster.intersections.length == 0) return

    let intersection
    let closestDistance = 9999
    let d
    for (let i of this.el.components.raycaster.intersections)
    {
      d = (navigator.xr ? i.distance : - i.distance)
      if (d < closestDistance)
      {
        intersection = i
        closestDistance = d
      }
    }
    if (!intersection) return
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
      let objRot = this.pool('objRot', THREE.Quaternion)
      intersection.object.getWorldQuaternion(objRot)
      let objUp = this.pool('objUp', THREE.Vector3)
      objUp.set(0, 1, 0)
      objUp.applyQuaternion(objRot)

      let objDir = this.pool('objForward', THREE.Vector3)
      objDir.copy(intersection.point)
      let thisPos = this.pool('thisPos', THREE.Vector3)
      this.el.object3D.getWorldPosition(thisPos)
      objDir.sub(thisPos)
      objDir.normalize()

      let objRight = this.pool('objRight', THREE.Vector3)
      objRight.crossVectors(objDir, objUp)


      let thisRot = this.pool('thisRot', THREE.Quaternion)
      this.el.object3D.getWorldQuaternion(thisRot)
      let thisUp = this.pool('thisUp', THREE.Vector3)
      thisUp.copy(this.el.object3D.up)
      thisUp.applyQuaternion(thisRot)

      rotation = Math.atan2(thisUp.dot(objUp), thisUp.dot(objRight))

      if (intersection.object.el.hasAttribute('geometry'))
      {
        rotation = Math.PI / 2 - rotation
      }
      else
      {
        rotation = Math.PI / 2 + rotation
      }
    }

    let params = this.params
    params.pressure = this.pressure
    params.rotation = rotation
    params.sourceEl = this.el
    params.distance = intersection.distance
    params.scale = this.distanceScale
    params.intersection = intersection
    params.brush = this.system.brush
    params.lastParams = null

    if (this.hasDrawn && this.singleShot) return

    if (this.isDrawing && !this.el.is("erasing")) {
      this.hasDrawn = true
      if (isDrawable)
      {
        Sfx.draw(this.el)
        if (this.lastParams.active) params.lastParams = this.lastParams
        drawCanvas.drawUV(intersection.uv, params)
        Object.assign(this.lastParams, params)
        this.lastParams.active = true
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

    if (isDrawable)
    {
      let targetCompositor = (drawCanvas.target || drawCanvas).el
      if (targetCompositor.components.compositor)
      {
        targetCompositor.components.compositor.overlays[this.id] = Object.assign({uv: intersection.uv, el: this.el}, params)
        this.lastCompositor = targetCompositor
      }

    }
  }
})

AFRAME.registerSystem('button-caster', {
  init() {
    this.casters = []
    this.installedButtons = new Set()
    this.triggeredEls = {}
  },
  register(el) {
    this.casters.push(el)

    for (let button of this.installedButtons)
    {
      el.addEventListener(button + 'down', e => {
        this.forwardDownEvent(el, button, e)
      })

      el.addEventListener(button + 'up', e => {
        this.forwardUpEvent(el, button, e)
      })
    }
  },
  install(buttons) {
    for (let button of buttons)
    {
      if (this.installedButtons.has(button)) continue

      for (let caster of this.casters) {
        caster.addEventListener(button + 'down', e => {
          this.forwardDownEvent(caster, button, e)
        })

        caster.addEventListener(button + 'up', e => {
          this.forwardUpEvent(caster, button, e)
        })
      }

      this.triggeredEls[button] = new Set()

      this.installedButtons.add(button)
    }
  },
  forwardDownEvent(caster, button, e) {
    console.log("Forwarding button", caster, button, e)
    if (caster.components.raycaster.intersections.length == 0) return

    let intersection = caster.components.raycaster.intersections.sort(i => navigator.xr ? i.distance : - i.distance)[0]
    let el = intersection.object.el

    if (this.triggeredEls[button].has(el)) return

    el.emit(button + 'down', e.detail)

    this.triggeredEls[button].add(el)
  },
  forwardUpEvent(caster, button, e) {
    for (let el of this.triggeredEls[button])
    {
      el.emit(button + 'up', e.detail)
      this.triggeredEls[button].delete(el)
    }
  }
})

// Sends button press events to the closest object intersected by this element's
// raycaster component. This way, components can listen to, eg, 'abuttondown'
// and 'abuttonup' events on their own elements, rather than having to look for
// every possible controller which could emit those events.
AFRAME.registerComponent('button-caster', {
  init() {
    this.system.register(this.el)
  }
})
