import {Sfx} from './sfx.js'
import {Util} from './util.js'
import {Pool} from './pool.js'
import Color from "color"
import {Brush} from './brush.js'
import {BrushList} from './brush-list.js'
import {Undo} from './undo.js'

AFRAME.registerSystem('pencil-tool', {
  clonePencil() {
    if (!this.lastGrabbed) return
    this.lastGrabbed.createLockedClone()
  },
  deletePencil() {
    if (!this.lastGrabbed) return
    if (!this.lastGrabbed.data.locked) return
    this.lastGrabbed.el.remove()
  },
  unlockPencil() {
    if (!this.lastGrabbed) return
    if (!this.lastGrabbed.data.locked) return
    let system = this.el.systems['paint-system']
    let tool = this.lastGrabbed.el.components['hand-draw-tool']
    if (!tool) return
    Object.assign(system.data, tool.system.data)
    system.brush = tool.system.brush
    system.el.emit('brushchanged', {brush: system.brush})
  },
  toggleGrabRotation() {
    document.querySelectorAll('*[manipulator]').forEach(e=>{
      if (e.is("rotating"))
      {
        e.removeState("rotating")
      }
      else
      {
        e.addState("rotating")
      }
    })
  },
  toggleTriggerGrab() {
    document.querySelectorAll('*[manipulator]').forEach(e=>{
      if (e.is("grabmode"))
      {
        e.removeState("grabmode")
        e.removeEventListener('triggerdown', e.components.manipulator.onGripClose)
        e.removeEventListener('triggerup', e.components.manipulator.onGripOpen)
      }
      else
      {
        e.addState("grabmode")
        e.addEventListener('triggerdown', e.components.manipulator.onGripClose)
        e.addEventListener('triggerup', e.components.manipulator.onGripOpen)
      }
    })
  },
  createHandle({radius, height}) {
    let cylinder = document.createElement('a-cylinder')
    cylinder.setAttribute('radius', radius)
    cylinder.setAttribute('height', height)
    cylinder.setAttribute('segments-radial', 10)
    cylinder.setAttribute('segments-height', 1)
    cylinder.setAttribute('material', 'side: double; src: #asset-shelf; metalness: 0.4; roughness: 0.7')
    cylinder.setAttribute('position', `0 ${-height / 2} 0`)
    cylinder.classList.add('clickable')
    cylinder.setAttribute('propogate-grab', "")
    return cylinder
  }
})

AFRAME.registerComponent('pencil-tool', {
  dependencies: ['grab-activate', 'six-dof-tool', 'hand-draw-tool'],
  schema: {
    throttle: {type: 'int', default: 30},
    scaleTip: {type: 'boolean', default: true},
    pressureTip: {type: 'boolean', default: false},
    detailTip: {type: 'boolean', default: false},
    drawThrough: {type: 'boolean', default: false},

    radius: {default: 0.03},
    tipRatio: {default: 0.2},
    extraStates: {type: 'array'},

    enabled: {default: true},

    locked: {default: false},
    brush: {default: undefined, type: 'string'},
    paintSystemData: {default: undefined, type: 'string'},
    lockedColor: {type: 'color'}
  },
  events: {
    'bbuttonup': function(e) {
      this.createLockedClone()
    },
    'stateadded': function(e) {
      if (e.detail === 'grabbed') {
        this.system.lastGrabbed = this

        this.overlay = this.overlay || {el: this.el}
        this.overlay.brush = this.el.components['hand-draw-tool'].system.brush

        Compositor.component.overlays[this.el.components['hand-draw-tool'].id] = this.overlay
      }
    },
    activate: function() { this.activatePencil() }
  },
  init() {
    this.el.classList.add('grab-root')

    this.el.setAttribute('six-dof-tool', 'lockedComponentDependencies', ['manipulator-weight'])

    this.el.sceneEl.systems['button-caster'].install(['bbutton'])

    for (let s of this.data.extraStates)
    {
      this.el.addState(s)
    }

    var lockedSystem
    if (this.data.locked)
    {
      let systemData;

      if (this.data.systemData)
      {
        systemData = JSON.parse(this.data.paintSystemData)
      }
      else
      {
        systemData = Object.assign({}, this.el.sceneEl.systems['paint-system'].data)
      }
      let brush = Brush.fromStore(JSON.parse(this.data.brush), BrushList)
      console.log("Restoring brush", brush)
      lockedSystem = {
        data: systemData,
        brush
      }

      Util.whenLoaded(this.el, () => {
        this.el.components['hand-draw-tool'].system = lockedSystem
      })

      this.el.setAttribute('six-dof-tool', 'locked', true)
    }

    let radius = this.data.radius
    let height = 0.3
    let tipHeight = height * this.data.tipRatio
    let cylinderHeight = height - tipHeight
    let cylinder = document.createElement('a-cylinder')
    this.height = height
    this.tipHeight = tipHeight
    cylinder.setAttribute('radius', radius)
    cylinder.setAttribute('height', cylinderHeight)
    cylinder.setAttribute('segments-radial', 10)
    cylinder.setAttribute('segments-height', 1)
    cylinder.setAttribute('material', 'side: double; src: #asset-shelf; metalness: 0.4; roughness: 0.7')
    cylinder.classList.add('clickable')
    cylinder.setAttribute('propogate-grab', "")

    this.handle = cylinder
    this.el.append(cylinder)

    if (this.data.locked)
    {
      cylinder.setAttribute('material', 'emissive', this.data.lockedColor)
      cylinder.setAttribute('material', 'emissiveIntensity', 0.04)
    }

    let tip;

    if (this.data.detailTip)
    {
      tip = document.createElement('a-cone')
      tip.setAttribute('radius-top', radius)
      tip.setAttribute('radius-bottom', 0)
      tip.setAttribute('segments-height', 2)
      tip.setAttribute('segments-radial', 4)
    }
    else if (this.data.pressureTip)
    {
      tip = document.createElement('a-sphere')
      tip.setAttribute('radius', tipHeight / 2)
      tip.setAttribute('segments-height', 12)
      tip.setAttribute('segments-width', 16)
    }
    else if (this.data.scaleTip)
    {
      tip = document.createElement('a-cone')
      tip.setAttribute('radius-top', radius)
      tip.setAttribute('radius-bottom', 0)
      tip.setAttribute('segments-height', 2)
      tip.setAttribute('segments-radial', 16)
    }
    else
    {
      tip = document.createElement('a-cylinder')
      tip.setAttribute('radius', radius / 2)
      tip.setAttribute('segments-height', 1)
      tip.setAttribute('segments-width', 16)
    }

    tip.setAttribute('height', tipHeight)
    tip.setAttribute('position', `0 -${cylinderHeight / 2 + tipHeight / 2} 0`)

    if (this.el.is("erasing"))
    {
      tip.setAttribute('material', 'metalness: 0; roughness: 0.9; color: #eee')
    }
    else
    {
      if (this.data.locked)
      {
         tip.setAttribute('material', {color: lockedSystem.brush.color, shader: 'flat'})
      }
      else
      {
        tip.setAttribute("show-current-color", "")
      }

      if (this.data.detailTip)
      {
        Util.whenLoaded(tip, () => {
          tip.setAttribute('material', {shader: 'standard'})
          tip.getObject3D('mesh').material.flatShading = true
          tip.getObject3D('mesh').material.needsUpdate = true
        })
      }
    }
    tip.classList.add('clickable')
    tip.setAttribute('propogate-grab', "")
    this.el.append(tip)
    tip.setAttribute('material', 'side', 'double')
    this.tip = tip

    let brushPreview = document.createElement('a-plane')
    this.el.append(brushPreview)

    if (this.data.locked)
    {
      brushPreview.setAttribute("material", {src: lockedSystem.brush.previewSrc, transparent: true})
    }
    else
    {
      brushPreview.setAttribute("show-current-brush", "")
    }
    brushPreview.setAttribute('width', radius)
    brushPreview.setAttribute('height', radius)
    brushPreview.setAttribute('rotation', '-90 180 0')
    brushPreview.setAttribute('position', `0 ${cylinderHeight / 2 + 0.0001} 0`)



    this.el.setAttribute('raycaster', `objects: .canvas; showLine: false; direction: 0 -1 0; origin: 0 -${cylinderHeight / 2} 0; far: ${tipHeight}`)
    this.el.object3D.up.set(0, 0, 1)

    this.el.setAttribute('hand-draw-tool', "")
    this.el.setAttribute('grab-options', "showHand: false")

    // Pre-activation
    this.raycasterTick = this.el.components.raycaster.tock
    this.el.components.raycaster.tock = function() {}

  },
  update(oldData) {
    this.updateEnabled()

    if (this.data.drawThrough)
    {
      this.tip.setAttribute('material', 'wireframe', true)
    }

    if (this.el.hasAttribute('preactivate-tooltip') && !this.el.hasAttribute('tooltip-style'))
    {
      this.el.setAttribute('tooltip-style', "scale: 0.3 0.3 1.0; offset: 0 -0.2 0")
    }
  },
  activatePencil({subPencil = false} = {}) {
    console.log("Activating pencil")
    this.el.setAttribute('action-tooltips', {trigger: 'Toggle Pencil', b: 'Clone Pencil', shelf: '6DoF Tool Shelf'})
    if (this.raycasterTick) this.el.components.raycaster.tock = this.raycasterTick
    this.el.addEventListener('raycaster-intersection', e => {
      if (!this.data.enabled) return
      this.updateDrawTool()
      this.el.components['hand-draw-tool'].isDrawing = true
      this.el.components['hand-draw-tool'].startDraw()
    })

    this.el.addEventListener('raycaster-intersection-cleared', e => {
      if (!this.data.enabled) return
      this.el.components['hand-draw-tool'].endDraw()
      this.el.components['hand-draw-tool'].isDrawing = false
    })

    this.el.addEventListener('click', e => {
      if (this.el.is('grabbed'))
      {
        this.data.enabled = !this.data.enabled
        this.updateEnabled()
      }
    })

    this.tick = AFRAME.utils.throttleTick(this._tick, this.data.throttle, this)
    this.activatePencil = function() { throw new Error("Tried to activate already activated pencil") }
  },
  calcFar() {
    return this.tipHeight * this.el.object3D.scale.x
  },
  updateRaycaster: function(far)
  {
    // setAttribute constitutes a memory problem. So just do this part manually
    let data = this.data
    var raycaster = this.raycaster;

    // Set raycaster properties.
    raycaster.far = data.far;
    raycaster.near = data.near;

    // Calculate unit vector for line direction. Can be multiplied via scalar to performantly
    // adjust line length.
    this.unitLineEndVec3.copy(data.origin).add(data.direction).normalize();
  },
  updateDrawTool() {
    let far = this.calcFar()
    this.el.components.raycaster.data.far = far
    this.updateRaycaster.call(this.el.components.raycaster)
    let handDrawTool = this.el.components['hand-draw-tool']
    let intersection = this.el.components.raycaster.intersections.sort(i => navigator.xr ? i.distance : - i.distance)[0]

    if (intersection)
    {
      this.hadIntersection = true
      let ratio = intersection.distance / far
      if (this.data.scaleTip)
      {
        handDrawTool.distanceScale = THREE.Math.lerp(1.0, 0.1, ratio)
      }
      else
      {
        handDrawTool.distanceScale = 1.0
      }

      if (this.data.pressureTip)
      {
        handDrawTool.pressure = THREE.Math.lerp(1.0, 0.1, ratio)
      }
      else
      {
        this.el.components['hand-draw-tool'].pressure = 1.0
      }
    }
    else if (this.hadIntersection && this.el.is('erasing'))
    {
      this.el.emit('fakeclearstate', 'erasing')
      this.hadIntersection = false
    }
  },
  _tick() {
    this.updateDrawTool()
  },
  tick() {},
  updateEnabled() {
    this.tip.setAttribute('visible', this.data.enabled)

    let handDrawTool = this.el.components['hand-draw-tool']
    if (!this.data.enabled && handDrawTool.isDrawing)
    {
      console.log("Ending draw")
      handDrawTool.endDraw()
      handDrawTool.isDrawing = false
    }
    else if (this.data.enabled && this.el.components.raycaster.intersectedEls.length > 0)
    {
      handDrawTool.isDrawing = true
      handDrawTool.startDraw()
    }
  },
  createLockedClone() {
    let clone = document.createElement('a-entity')
    this.el.parentEl.append(clone)

    let paintSystem = this.el.components['hand-draw-tool'].system

    clone.setAttribute('pencil-tool', Object.assign({}, this.el.getAttribute('pencil-tool'), {
      locked: true,
      brush: JSON.stringify(paintSystem.brush.store()),
      paintSystemData: JSON.stringify(paintSystem.data),
      lockedColor: Color(`hsl(${Math.random() * 360}, 100%, 80%)`).rgb().hex(),
    }))
    clone.setAttribute('six-dof-tool', {lockedClone: true, lockedComponent: 'pencil-tool'})

    for (let dependency of this.el.components['six-dof-tool'].data.lockedComponentDependencies)
    {
      if (!this.el.hasAttribute(dependency)) continue
      clone.setAttribute(dependency, this.el.getAttribute(dependency))
    }

    Util.whenLoaded(clone, () => {
      Util.positionObject3DAtTarget(clone.object3D, this.el.object3D)
      clone.emit('activate', {})
    })

    return clone
  }
})

AFRAME.registerComponent('multi-pencil-base', {
  init() {
    this.el.setAttribute('grab-options', "showHand: false")
    this.el.classList.add('grab-root')

    let activate = (e) => {
      if (e.detail === 'grabbed')
      {
        this.el.querySelectorAll('*[pencil-tool]').forEach(e => e.components['pencil-tool'].activatePencil({subPencil: true}))
        this.el.removeEventListener('stateadded', activate)
      }
    };
    this.el.addEventListener('stateadded', activate)

  },
  calcFarFn(pencil) {
    return (() => pencil.components['pencil-tool'].tipHeight * this.el.object3D.scale.x)
  }
})

AFRAME.registerComponent('pencil-broom', {
  dependencies: ['multi-pencil-base', 'six-dof-tool'],
  init() {
    this.base = this.el.components['multi-pencil-base']

    for (let j = 0; j < 4; j++)
    {
      for (let i = 0; i < 3; i++)
      {
        let pencil = document.createElement('a-entity')
        pencil.setAttribute('pencil-tool', "")
        pencil.setAttribute('position', `${j * 0.05 + (j % 2) *0.02} 0 ${i * 0.05}`)
        pencil['redirect-grab'] = this.el
        this.el.append(pencil)
        pencil.components['pencil-tool'].calcFar = this.base.calcFarFn(pencil)
      }
    }
  },
})

AFRAME.registerComponent('spike-ball', {
  dependencies: ['multi-pencil-base', 'six-dof-tool'],
  init() {
    this.base = this.el.components['multi-pencil-base']
    for (let i = 0; i < 10; i++)
    {
      let pencil = document.createElement('a-entity')
      pencil.setAttribute('pencil-tool', "")
      pencil.setAttribute('rotation', `${Math.random() * 360} ${Math.random() * 360} ${Math.random() * 360}`)
      pencil['redirect-grab'] = this.el
      this.el.append(pencil)
      pencil.components['pencil-tool'].calcFar = this.base.calcFarFn(pencil)
    }

    // TODO: Need to make each pencil's far value match the parent scale
  }
})

AFRAME.registerComponent('hammer-tool', {
  dependencies: ['multi-pencil-base', 'six-dof-tool'],
  schema: {
    throttle: {type: 'int', default: 30},
    scaleTip: {type: 'boolean', default: true},
    pressureTip: {type: 'boolean', default: false},
  },
  init() {
    let handleHeight = 0.3
    let handleRadius = 0.03
    let handle = document.createElement('a-cylinder')
    handle.setAttribute('radius', handleRadius)
    handle.setAttribute('height', handleHeight)
    handle.setAttribute('segments-radial', 10)
    handle.setAttribute('segments-height', 1)
    handle.setAttribute('material', 'side: double; src: #asset-shelf; metalness: 0.4; roughness: 0.7')
    handle.classList.add('clickable')
    handle.setAttribute('propogate-grab', "")
    this.el.append(handle)

    let headRadius = 0.05
    let headLength = 0.2
    let headHolder = document.createElement('a-entity')
    headHolder.setAttribute('rotation', '0 0 90')
    headHolder.setAttribute('rotation', '0 0 90')
    headHolder.setAttribute('position', `0 ${handleHeight / 2.0} 0`)
    this.el.append(headHolder)
    let head = document.createElement('a-cylinder')
    this.head = head
    head.setAttribute('radius', headRadius)
    head.setAttribute('height', headLength)
    head.setAttribute('segments-radial', 10)
    head.setAttribute('segments-height', 1)
    // head.classList.add('clickable')
    head.setAttribute('propogate-grab', "")
    head.setAttribute('material', 'side: double; color: #aaa; metalness: 0.9; roughness: 0.4')

    head.setAttribute('raycaster', `objects: .canvas; showLine: true; direction: 0 1 0; origin: 0 0 0; far: ${headLength / 2}`)
    head.setAttribute('hand-draw-tool', "")
    headHolder.append(head)

    let tip = document.createElement('a-sphere')
    tip.setAttribute('radius', 0.01)
    tip.setAttribute('show-current-color', "")
    tip.setAttribute('position', `0 ${headLength / 2} 0`)
    tip.setAttribute('propogate-grab', "")
    tip.setAttribute('segments-height', 8)
    tip.setAttribute('segments-width', 12)
    head.append(tip)
    this.tip = tip

    this._tick = this.tick
    this.tick = AFRAME.utils.throttleTick(this.tick, this.data.throttle, this)

    head.addEventListener('raycaster-intersection', e => {
      let pct = THREE.Math.mapLinear(this.speed, 0, 0.008, 0, 1)
      console.log("Hit", this.speed, pct)
      // this.updateDrawTool()
      let handDrawTool = head.components['hand-draw-tool']
      handDrawTool.pressure = pct
      // handDrawTool.distanceScale = pct
      handDrawTool.isDrawing = true
      handDrawTool.hasDrawn = false
      handDrawTool.singleShot = true
      handDrawTool.startDraw()
      Sfx.bang(this.el)
      this.el.addState('hitting')
    })

    head.addEventListener('raycaster-intersection-cleared', e => {
      console.log("Hit cleared")
      this.el.removeState('hitting')
    })
  },
  tick(t, dt) {
    if (!this.velocity)
    {
      this.velocity = new THREE.Vector3()
      this.lastPosition = new THREE.Vector3()
      this.position = new THREE.Vector3()
      this.tip.object3D.getWorldPosition(this.lastPosition)
      return
    }

    if (this.el.is("hitting"))
    {
      let handDrawTool = this.head.components['hand-draw-tool']
      if (handDrawTool.hasDrawn)
      {
        handDrawTool.isDrawing = false
        handDrawTool.hasDrawn = false
        handDrawTool.endDraw()
      }
      return
    }

    let {lastPosition, position, velocity} = this
    this.tip.object3D.getWorldPosition(position)
    velocity.subVectors(position, lastPosition)
    this.speed = velocity.length() / dt
    lastPosition.copy(position)
    // console.log(this.speed)
  }
})

AFRAME.registerComponent('drip-tool', {
  dependencies: ['six-dof-tool'],
  schema: {
    radius: {default: 0.06},
    tipRatio: {default: 0.2},

    maxRate: {default: 120},
  },
  events: {
    click: function(e) { this.addDrop() }
  },
  init() {
    Pool.init(this)
    this.el.classList.add('grab-root')
    this.el.setAttribute('grab-options', "showHand: false")

    let radius = this.data.radius
    let height = 0.3
    let tipHeight = height * this.data.tipRatio
    let cylinderHeight = height - tipHeight
    let cylinder = document.createElement('a-cylinder')
    this.height = height
    this.tipHeight = tipHeight
    cylinder.setAttribute('radius', radius)
    cylinder.setAttribute('height', cylinderHeight)
    cylinder.setAttribute('segments-radial', 10)
    cylinder.setAttribute('segments-height', 1)
    cylinder.setAttribute('material', 'side: double; src: #asset-shelf; metalness: 0.4; roughness: 0.7')
    cylinder.setAttribute('position', `0 ${-cylinderHeight / 2.0} 0`)
    cylinder.classList.add('clickable')
    cylinder.setAttribute('propogate-grab', "")
    this.el.append(cylinder)

    this.drops = []
    this.raycaster = new THREE.Raycaster()
  },
  addDrop() {
    let drop = document.createElement('a-sphere')
    drop.setAttribute('radius', this.data.radius * 2.0 / 3.0)
    drop.setAttribute('color', this.el.sceneEl.systems['paint-system'].brush.color)
    Util.whenLoaded(drop, () => {
      drop.object3D.position.copy(this.el.object3D.position)
    })
    drop.object3D.velocity = new THREE.Vector3(0, 0, 0)
    this.el.parentEl.append(drop)
    this.drops.push(drop)
  },
  tick(t,dt) {
    this.updateDrops(t, dt)

    if (!this.el.is("grabbed")) return

    let up = this.pool('up', THREE.Vector3)
    up.set(0, 1.0, 0)
    up.transformDirection(this.el.object3D.matrixWorld)
    let amount = (1 - up.dot(this.el.sceneEl.object3D.up)) / 2.0

    amount = THREE.Math.smootherstep(amount, 0.005, 1.0)

    if (!this.lastDropTime) {
      this.lastDropTime = t
      return
    }

    let expectedInterval = this.data.maxRate / amount

    if (t - this.lastDropTime > expectedInterval)
    {
      this.addDrop()
      this.lastDropTime = t
    }
  },
  updateDrops(t,dt) {
    if (this.drops.length === 0) return
    let nextPos = this.pool('nextPos', THREE.Vector3)
    let objects = Array.from(document.querySelectorAll('.canvas, .clickable')).filter(el => !(el == this.el || this.el.contains(el))).map(o => o.object3D)

    let direction = this.pool('dir', THREE.Vector3)
    let posWorld = this.pool('posWorld', THREE.Vector3)

    let intersections = []

    for (let drop of this.drops)
    {
      let d3D = drop.object3D
      d3D.velocity.y += - 9.8 * dt / 1000.0 / 1000.0

      d3D.velocity.clampLength(0, 0.005)
      nextPos.copy(d3D.position)
      nextPos.addScaledVector(d3D.velocity, dt)

      direction.copy(d3D.velocity).transformDirection(d3D.matrixWorld).normalize()

      posWorld.copy(d3D.position)
      d3D.parent.localToWorld(posWorld)

      this.raycaster.set(posWorld, direction)
      this.raycaster.far = d3D.velocity.length() * dt + 0.01

      intersections.length = 0
      this.raycaster.intersectObjects(objects, true, intersections)

      let intersection = intersections.filter(i => i.object.el).sort(i => navigator.xr ? i.distance : - i.distance)[0]

      if (intersection)
      {
        this.removeDrop(drop)

        let el = intersection.object.el
        if (el)
        {
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
          if (isDrawable)
          {
            drawCanvas.drawUV(intersection.uv, {})
          }
        }
      }

      d3D.position.copy(nextPos)

      if (d3D.position.length() > 10) this.removeDrop()
    }
  },
  removeDrop(drop) {
    if (this.drops.indexOf(drop) < 0) return
    Sfx.play('sfx-05', drop)
    this.el.parentEl.removeChild(drop)
    this.drops.splice(this.drops.indexOf(drop), 1)
  },
})

AFRAME.registerComponent('six-dof-tool', {
  schema: {
    lockedClone: {default: false},
    lockedComponent: {type: 'string'},
    lockedComponentDependencies: {type: 'array', default: []},
    reparentOnActivate: {default: true},
    summonable: {default: true},
  },
  events: {
    activate: function() {
      // Move the tool's parent to the world root, so it doesn't get
      // accidentally hidden when the UI is hidden
      if (this.data.reparentOnActivate)
      {
        console.log("Reparenting", this.data)
        let wm = new THREE.Matrix4
        this.el.object3D.updateMatrixWorld()
        wm.copy(this.el.object3D.matrixWorld)
        this.el.object3D.parent.remove(this.el.object3D)
        document.querySelector('#world-root').object3D.add(this.el.object3D)
        Util.applyMatrix(wm, this.el.object3D)
      }
    }
  },
  init() {
    if (this.data.summonable && !this.el.hasAttribute('summonable')) {
      this.el.setAttribute('summonable', 'once: true; activateOnSummon: true')
    }
  }
})

AFRAME.registerComponent('summonable', {
  schema: {
    speechOnly: {default: false},
    once: {default: true},
    activateOnSummon: {default: true}
  },
  events: {
    activate: function(e) {
      this.hasFlown = true
      if ((this.el.getAttribute('action-tooltips').trigger || "").startsWith('Summon')) {
        this.el.setAttribute('action-tooltips', {trigger: null})
      }
    },
    click: function(e) {
      if (this.data.once && this.hasFlown) return
      if ((this.data.speechOnly) && !(e.detail && e.detail.type === "speech")) return

      this.flyToUser()
    }
  },
  init() {
    this.el.setAttribute('action-tooltips', {trigger: 'Summon ' + (this.el.hasAttribute('preactivate-tooltip') ? this.el.getAttribute('preactivate-tooltip') : "")})
  },
  flyToUser() {
    this.hasFlown = true

    Util.flyToCamera(this.el)

    if (this.data.activateOnSummon)
    {
      this.el.emit('activate')
    }
  }
})

AFRAME.registerComponent('viewport-tool', {
  dependencies: ['six-dof-tool', 'grab-activate'],
  events: {
    click: function(e) {
      this.positionViewport()
    }
  },
  init() {
    Pool.init(this)
    this.el.classList.add('grab-root')
    let body = document.createElement('a-cylinder')
    body.setAttribute('height', 0.3)
    body.setAttribute('radius', 0.07)
    body.setAttribute('segments-radial', 6)
    body.setAttribute('segments-height', 1)
    body.setAttribute('material', 'side: double; src: #asset-shelf; metalness: 0.4; roughness: 0.7')
    body.classList.add('clickable')
    body.setAttribute('propogate-grab', "")
    this.el.append(body)

    let base = document.createElement('a-cylinder')
    base.setAttribute('height', 0.06)
    base.setAttribute('radius', 0.16)
    base.setAttribute('segments-radial', 6)
    base.setAttribute('segments-height', 1)
    base.setAttribute('material', 'side: double; src: #asset-shelf; metalness: 0.4; roughness: 0.7')
    base.classList.add('clickable')
    base.setAttribute('propogate-grab', "")
    base.setAttribute('position', '0 -0.15 0')
    this.el.append(base)

    let arrow = document.createElement('a-cone')
    arrow.setAttribute('radius-bottom', 0.04)
    arrow.setAttribute('height', 0.08)
    arrow.setAttribute('position', '0 0.08 -0.1')
    arrow.setAttribute('rotation', '-90 0 0')
    arrow.setAttribute('segments-radial', 4)
    arrow.setAttribute('material', 'src: #asset-shelf; metalness: 0.4; roughness: 0.7; flatShading: true')
    this.el.append(arrow)

    this.el.setAttribute('summonable', 'speechOnly', 'true')
  },
  positionViewport() {
    let cameraObj = document.querySelector('#camera').object3D
    // let offset = this.pool('offset', THREE.Vector3)
    // offset.copy(cameraObj.position)
    // offset.multiplyScalar(-1)
    // offset.y += 0.2
    //

    //
    // let targetObj = document.querySelector('#camera-root').object3D
    //
    // let oldRotation = this.pool('oldRotation', THREE.Quaternion)
    // oldRotation.copy(targetObj.quaternion)
    // Util.positionObject3DAtTarget(targetObj, this.el.object3D, {transformOffset: offset})
    // targetObj.quaternion.copy(oldRotation)
    //
    // if (!this.el.sceneEl.is('vr-mode'))
    // {
    //   document.querySelector('#camera-root').components['look-controls'].yawObject.rotateOnAxis(this.el.sceneEl.object3D.up, angle)
    // }
    // document.querySelector('#camera').object3D.rotateOnAxis(this.el.sceneEl.object3D.up, angle)

    this.el.sceneEl.systems['artist-root'].resetPosition()
    let targetObj = document.querySelector('#artist-root').object3D
    Util.positionObject3DAtTarget(targetObj, this.el.object3D)
    targetObj.position.y -= document.querySelector('#camera-root').object3D.position.y - 0.6
    targetObj.quaternion.w = 1
    targetObj.quaternion.y = 0
    targetObj.quaternion.x = 0
    targetObj.quaternion.z = 0

    // let cameraForward = this.pool('cameraForward', THREE.Vector3)
    // let forward = this.pool('forward', THREE.Vector3)
    // cameraObj.getWorldDirection(cameraForward)
    // this.el.object3D.getWorldDirection(forward)
    // forward.y = 0
    // cameraForward.y = 0
    // forward.normalize()
    // cameraForward.normalize()
    // //
    // let angle = forward.angleTo(cameraForward)
    //
    // targetObj.rotateOnAxis(this.el.sceneEl.object3D.up, angle)
  }
})

AFRAME.registerComponent('movement-tool', {
  dependencies: ['six-dof-tool', 'grab-activate', 'summonable'],
  schema: {
    speed: {default: 2.5}
  },
  events: {
    activate: function() {
      // this.tick = AFRAME.utils.throttleTick(this._tick, 100, this)
      this.tick = this._tick
    },
    stateremoved: function(e) {
      if (e.detail === 'grabbed')
      {
        this.grip.object3D.position.set(0,0,0)
      }
    }
  },
  init() {
    Pool.init(this)
    this.el.classList.add('grab-root')
    this.el.setAttribute('grab-options', 'showHand: false')
    let body = document.createElement('a-cylinder')
    body.setAttribute('height', 0.3)
    body.setAttribute('radius', 0.07)
    body.setAttribute('segments-radial', 6)
    body.setAttribute('segments-height', 1)
    body.setAttribute('material', 'side: double; src: #asset-shelf; metalness: 0.4; roughness: 0.7')
    body.classList.add('clickable')
    body.setAttribute('propogate-grab', "")
    this.el.append(body)

    let gripPositioner = document.createElement('a-entity')
    gripPositioner.setAttribute('position', '0 0.25 0')
    let grip = document.createElement('a-sphere')
    grip.setAttribute('radius', 0.07)
    grip.setAttribute('segments-radial', 6)
    grip.setAttribute('segments-height', 4)
    grip.setAttribute('material', 'side: double; metalness: 0.7; roughness: 0.3')
    grip.setAttribute('constrain-to-sphere', 'innerRadius: 0; outerRadius: 0.14')
    grip.setAttribute('action-tooltips', 'grip: Move around')
    grip.classList.add('clickable')
    gripPositioner.append(grip)
    this.gripPositioner = gripPositioner
    this.grip = grip
    this.el.append(gripPositioner)
    this.artistRoot = document.querySelector('#artist-root')
  },
  tick() {},
  _tick(t,dt) {
    if (!this.grip.is('grabbed')) return

    let worldRoot = this.pool('worldThis', THREE.Vector3)
    let worldGrip = this.pool('worldGrip', THREE.Vector3)

    this.gripPositioner.object3D.getWorldPosition(worldRoot)
    this.grip.object3D.getWorldPosition(worldGrip)

    worldGrip.sub(worldRoot)

    this.artistRoot.object3D.position.addScaledVector(worldGrip, dt / 1000.0 * this.data.speed)
    this.artistRoot.object3D.scale.copy(this.grip.object3D.scale)
    this.artistRoot.object3D.scale.multiply(this.artistRoot.object3D.scale)
    // this.el.object3D.position.addScaledVector(worldGrip, dt / 1000.0 * this.data.speed)
  },
})

AFRAME.registerComponent('selection-box-tool', {
  dependencies: ['six-dof-tool', 'grab-activate'],
  schema: {
    boxSize: {type: 'vec3', default: {x: 0.2, y: 0.2, z: 0.2}},
    selector: {type: 'string', default: '.clickable, .canvas'},
    grabElements: {default: true},
    grabVertices: {default: false},
    undoable: {default: false},
    duplicateOnGrab: {default: false},
  },
  events: {
    stateadded: function(e) {
      if (e.detail === 'grabbed')
      {
        this.startGrab()
      }
    },
    stateremoved: function(e) {
      if (e.detail === 'grabbed')
      {
        this.stopGrab()
      }
    },
    click: function(e) {
      this.toggleGrabbing(!this.grabbing)
    }
  },
  init() {
    this.el.classList.add('grab-root')
    this.handle = this.el.sceneEl.systems['pencil-tool'].createHandle({radius: 0.07, height: 0.3})
    this.el.append(this.handle)
    Pool.init(this)

    let box = document.createElement('a-box')
    this.box = box
    box.classList.add('clickable')
    box.setAttribute('material', 'color: #333; shader: matcap; wireframe: true')
    this.el.append(box)
    this.grabbing = false

    // this.box.setAttribute('axis-handles', "")
  },
  update(oldData) {
    this.box.setAttribute('width', this.data.boxSize.x)
    this.box.setAttribute('height', this.data.boxSize.y)
    this.box.setAttribute('depth', this.data.boxSize.z)
    this.box.setAttribute('position', {x: 0, y: this.data.boxSize.y / 2, z: 0})

    if (this.data.grabElements && this.data.duplicateOnGrab)
    {
      throw new Error("Duplicating elements doesn't work yet")
    }
  },
  toggleGrabbing(newGrabbing) {
    if (this.grabbing === newGrabbing) return;
    this.grabbing = newGrabbing;
    this.box.setAttribute('material', 'color', this.grabbing ? '#6fde96' : "#333")
    if (this.grabbing && this.el.is('grabbed'))
    {
      this.startGrab()
    }
    else if (this.el.is('grabbed'))
    {
      this.stopGrab()
    }
  },
  startGrab() {
    let objects = document.querySelectorAll(this.data.selector)
    if (!this.data.grabElements)
    {
      let newObjects = []
      for (let el of objects)
      {
        Util.traverseFindAll(el.object3D, o => o.type === 'Mesh' || o.type === 'SkinnedMesh', {outputArray: newObjects, visibleOnly: true})
      }
      objects = newObjects.map(o => { return {object3D: o}})
    }
    this.grabbers = {}
    this.grabbed = {}
    this.grabberId = {}

    this.box.getObject3D('mesh').geometry.computeBoundingBox()
    let boundingBox = this.box.getObject3D('mesh').geometry.boundingBox

    let worldPos = this.pool('worldPos', THREE.Vector3)
    let localPos = this.pool('localPos', THREE.Vector3)
    for (let el of objects) {
      let target = this.data.grabElements ? Util.resolveGrabRedirection(el) : el

      if (target === this.el) continue
      if (target.object3D.uuid in this.grabbers) continue

      if (this.data.grabElements)
      {
        el.object3D.getWorldPosition(worldPos)
        localPos.copy(worldPos)
        this.box.getObject3D('mesh').worldToLocal(localPos)
        if (!boundingBox.containsPoint(localPos)) continue
      }
      else
      {
        let contained = false
        for (let i = 0; i < el.object3D.geometry.attributes.position.count; ++i)
        {
          worldPos.fromBufferAttribute(el.object3D.geometry.attributes.position, i)
          el.object3D.localToWorld(worldPos)
          this.box.getObject3D('mesh').worldToLocal(worldPos)
          if (boundingBox.containsPoint(worldPos))
          {
            contained = true
            break
          }
        }
        if (!contained) continue
      }

      if (this.data.duplicateOnGrab)
      {
        let oldObject = target.object3D
        let newObject = oldObject.clone(true)
        oldObject.parent.add(newObject)
        target.object3D = newObject
      }

      let obj = new THREE.Object3D
      this.el.object3D.add(obj)
      Util.positionObject3DAtTarget(obj, target.object3D)
      this.grabbers[target.object3D.uuid] = obj
      this.grabbed[obj.uuid] = target
      this.grabberId[obj.uuid] = obj

      if (this.grabVertices)
      {
        let grabChild = new THREE.Object3D
        target.object3D.add(grabChild)
        this.grabChildren[obj.uuid] = grabChild
      }
    }
    if (Object.values(this.grabbed).length > 0) {
      Undo.collect(() => {
        if (this.data.duplicateOnGrab)
        {
            for (let o of Object.values(this.grabbed))
            {
              Undo.push(() => o.parent.remove(o))
            }
            return;
        }

        for (let o of Object.values(this.grabbed))
        {
          Undo.pushObjectMatrix(o.object3D)
        }
      })
    }
    this.tick = this._tick;
  },
  stopGrab() {
    this.tick = function(){};
    if (this.data.duplicateOnGrab && this.grabbing)
    {
      this.toggleGrabbing(false)
    }
  },
  tick(t,dt) {},
  _tick(t, dt) {
    if (!this.el.is('grabbed')) return
    if (!this.grabbing) return

    for (let obj of Object.values(this.grabbers))
    {
      Util.positionObject3DAtTarget(this.grabbed[obj.uuid].object3D, obj)

      //?
      // if (this.grabbed[obj.uuid].manipulatorConstraint) this.grabbed[obj.uuid].manipulatorConstraint(t, dt)

    }
  }
})

AFRAME.registerComponent('dynamic-pencil-weight', {
  tick(t, dt) {
    if (!this.el.is("grabbed")) return;
    let intersection = this.el.components.raycaster.intersections[0]
    if (!intersection) {
      this.el.components['manipulator-weight'].data.weight = 0
      return
    }
    let far = this.el.components['pencil-tool'].calcFar()
    let ratio = intersection.distance / far
    this.el.components['manipulator-weight'].data.weight = THREE.Math.mapLinear(Math.exp(ratio), Math.exp(0), Math.exp(1.0), 1.0, 0.1)
    console.log("Setting weight", this.el.components['manipulator-weight'].data.weight)
  }
})
