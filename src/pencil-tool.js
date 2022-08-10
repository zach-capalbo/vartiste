import {Sfx} from './sfx.js'
import {Util} from './util.js'
import {Pool} from './pool.js'
import Color from "color"
import {Brush} from './brush.js'
import {BrushList} from './brush-list.js'
import {Undo} from './undo.js'
import {PARENTABLE_TARGETS, ALL_MESHES} from './decorators.js'

let SENSITIVITY_FUNCTIONS = {
  constant: (ratio) => 1.0,
  linear: (ratio) => THREE.Math.lerp(1.0, 0.1, ratio),
  exponential: (ratio) => Math.exp(1.0 - ratio) / Math.exp(1.0),
  log: (ratio) => Math.log(2.0 - ratio) / Math.log(2.0),
  quad: (ratio) => (1.0 - ratio) * (1.0 - ratio),
  sin: (ratio) => Math.cos(Math.PI / 2.0 * ratio),
  wave: (ratio) => Math.cos(20.0 * Math.PI * ratio),
  inverted: (ratio) => THREE.Math.lerp(0.1, 1, ratio),
}

Util.registerComponentSystem('pencil-tool-sensitivity', {
  schema: {
    scaleFunction: {oneOf: Object.keys(SENSITIVITY_FUNCTIONS), default: "linear"},
    opacityFunction: {oneOf: Object.keys(SENSITIVITY_FUNCTIONS), default: "linear"},
  },
  update(oldData) {
    console.log("Setting sensitivity functions", this.data.scaleFunction, this.data.opacityFunction)
    this.scaleFunction = SENSITIVITY_FUNCTIONS[this.data.scaleFunction]
    this.opacityFunction = SENSITIVITY_FUNCTIONS[this.data.opacityFunction]
  },
})

AFRAME.registerSystem('pencil-tool', {
  init() {
    this.sensitivity = this.el.sceneEl.systems['pencil-tool-sensitivity']
  },
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
  createHandle({radius, height, parentEl, segments = 10}) {
    let cylinder = document.createElement('a-cylinder')

    if (parentEl)
    {
      parentEl.append(cylinder)
    }
    else
    {
      console.warn("Should specify a parent el to avoid more warnings")
    }

    cylinder.setAttribute('radius', radius)
    cylinder.setAttribute('height', height)
    cylinder.setAttribute('segments-radial', segments)
    cylinder.setAttribute('segments-height', 1)
    cylinder.setAttribute('material', 'side: double; src: #asset-shelf; metalness: 0.4; roughness: 0.7')
    cylinder.setAttribute('position', `0 ${-height / 2} 0`)
    cylinder.classList.add('clickable')
    cylinder.setAttribute('propogate-grab', "")
    return cylinder
  },
  createConnectedFlag(parentEl, {selector = ALL_MESHES, connectorName} = {})
  {
    let flag = document.createElement('a-entity')
    parentEl.append(flag)
    flag.setAttribute('decorator-flag', `resolveProxy: true; selector: ${selector}`)
    parentEl.setAttribute('selection-box-tool', 'selector: a-entity.clickable[reference-glb], a-entity.clickable[primitive-construct-placeholder]')
    flag.setAttribute('position', '0.1 0 0')
    flag.setAttribute('tooltip-style', "scale: 0.3 0.3 1.0; offset: 0 -0.3 0.16")
    parentEl.setAttribute(`cable-connector${connectorName ? "__" + connectorName : ""}`, {target: flag, lineWidth: 0.01, sourceOffset: new THREE.Vector3(0, -0.2, 0), targetOffset: new THREE.Vector3(0, 0, 0.1)})
    return flag
  },
  resetAllTools() {
    this.el.sceneEl.querySelectorAll('a-entity[six-dof-tool]').forEach(el => {
      if (el.components['six-dof-tool'].data.resettable) {
        el.components['six-dof-tool'].resetPosition()
      }
    })
  }
})

// Creates a grabbable pencil which can be used to draw onto [`drawable`](#drawable)
// components
AFRAME.registerComponent('pencil-tool', {
  dependencies: ['grab-activate', 'six-dof-tool'],
  schema: {
    throttle: {type: 'int', default: 30},
    scaleTip: {type: 'boolean', default: true},
    pressureTip: {type: 'boolean', default: false},
    detailTip: {type: 'boolean', default: false},
    drawThrough: {type: 'boolean', default: false},

    radius: {default: 0.03},
    tipRatio: {default: 0.2},
    extraStates: {type: 'array'},
    extraRayLength: {default: 0.0},

    enabled: {default: true},

    locked: {default: false},
    lockable: {default: true},
    brush: {default: undefined, type: 'string', parse: o => o},
    paintSystemData: {default: undefined, type: 'string', parse: o => o},
    lockedColor: {type: 'color'},

  },
  events: {
    'bbuttonup': function(e) {
      if (this.data.lockable)
      {
        this.createLockedClone()
      }
    },
    'stateadded': function(e) {
      if (e.detail === 'grabbed' || e.detail === 'wielded') {
        this.system.lastGrabbed = this

        this.overlay = this.overlay || {el: this.el}
        this.overlay.brush = this.el.components['hand-draw-tool'].system.brush

        if (window.Compositor && window.Compositor.el)
        {
          window.Compositor.component.overlays[this.el.components['hand-draw-tool'].id] = this.overlay
        }
      }
    },
    activate: function() { this.activatePencil() },
    resetposition: function() { this.deactivatePencil() }
  },
  async init() {
    this.el.classList.add('grab-root')
    this.el.setAttribute('shadow', 'cast: true; receive: false')
    this.activatePencil = this._activatePencil;

    if (this.el.hasAttribute('set-brush'))
    {
      this.data.locked = true
      this.data.lockable = false
      await Util.whenComponentInitialized(this.el, 'set-brush')
    }

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
      let brush;

      if (this.el.hasAttribute('set-brush'))
      {
        if (this.el.components['set-brush'] && this.el.components['set-brush'].brush)
        {
          brush = this.el.components['set-brush'].brush
        }
        else
        {
          brush = new Brush()
        }
      }
      else {
        brush = Brush.fromStore(JSON.parse(this.data.brush), BrushList)
      }

      // console.log("Restoring brush", brush)
      console.log("Restoring brush", brush.constructor.name, brush.baseid)
      lockedSystem = {
        data: systemData,
        brush
      }

      Util.whenComponentInitialized(this.el, 'hand-draw-tool', () => {
        this.el.components['hand-draw-tool'].system = lockedSystem
      })

      // this.el.setAttribute('six-dof-tool', 'lockedClone', true)
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

    if (this.el.is("erasing") || (this.el.hasAttribute('set-brush') && this.el.getAttribute('set-brush').mode === 'destination-out'))
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
          tip.setAttribute('material', {shader: 'standard', transparent: false})
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

    this.el.object3D.up.set(0, 0, 1)

    this.el.setAttribute('grab-options', "showHand: false")

    // Pre-activation
    this.el.setAttribute('raycaster', `objects: .canvas; showLine: false; direction: 0 -1 0; origin: 0 -${cylinderHeight / 2} 0; far: ${tipHeight}`)
    this.raycasterTick = this.el.components.raycaster.tock
    this.el.components.raycaster.tock = function() {}
    this.el.setAttribute('hand-draw-tool', "")

  },
  update(oldData) {
    if (!this.tip) return
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
  _activatePencil({subPencil = false} = {}) {
    console.log("Activating pencil")
    this.el.setAttribute('action-tooltips', {trigger: 'Toggle Pencil', b: 'Clone Pencil', shelf: '6DoF Tool Shelf'})
    if (this.raycasterTick) this.el.components.raycaster.tock = this.raycasterTick
    this.raycasterIntersection = e => {
      if (!this.data.enabled) return
      this.updateDrawTool()
      this.el.components['hand-draw-tool'].isDrawing = true
      this.el.components['hand-draw-tool'].startDraw()
    };

    this.el.addEventListener('raycaster-intersection', this.raycasterIntersection)

    this.raycasterIntersectionCleared = e => {
      if (!this.data.enabled) return
      this.el.components['hand-draw-tool'].endDraw()
      this.el.components['hand-draw-tool'].isDrawing = false
    };

    this.el.addEventListener('raycaster-intersection-cleared', this.raycasterIntersectionCleared)

    this.clickHandler = e => {
      if (this.el.is('grabbed'))
      {
        this.data.enabled = !this.data.enabled
        this.updateEnabled()
      }
    };
    this.el.addEventListener('click', this.clickHandler)

    this.tick = AFRAME.utils.throttleTick(this._tick, this.data.throttle, this)
    this.activatePencil = function() { throw new Error("Tried to activate already activated pencil") }
  },
  deactivatePencil() {
    if (this.el.components['hand-draw-tool'].isDrawing)
    {
      this.el.components['hand-draw-tool'].endDraw()
    }

    this.el.removeEventListener('raycaster-intersection', this.raycasterIntersection)
    this.el.removeEventListener('raycaster-intersection-cleared', this.raycasterIntersectionCleared)
    this.el.removeEventListener('click', this.clickHandler)
    this.tick = function() {}
    if (this.raycasterTick) this.el.components.raycaster.tock = function () {}
    this.activatePencil = this._activatePencil;
  },
  calcFar() {
    return this.tipHeight * this.el.object3D.scale.x + this.data.extraRayLength
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
        handDrawTool.distanceScale = this.system.sensitivity.scaleFunction(ratio)
      }
      else
      {
        handDrawTool.distanceScale = 1.0
      }

      if (this.data.pressureTip)
      {
        // handDrawTool.pressure = THREE.Math.lerp(1.0, 0.1, ratio)
        handDrawTool.pressure = this.system.sensitivity.opacityFunction(ratio)
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
    resettable: {default: true},
    summonable: {default: false},
    orientation: {default: {x: 0, y: -1, z: 0}, type: 'vec3'},
  },
  events: {
    activate: function() {
      // Move the tool's parent to the world root, so it doesn't get
      // accidentally hidden when the UI is hidden
      if (this.data.reparentOnActivate)
      {
        if (this.data.resettable)
        {
          this.resetInfo = {
            parentEl: this.el.parentEl,
            parentObject: this.el.object3D.parent,
            matrix: new THREE.Matrix4().copy(this.el.object3D.matrix)
          }
        }
        console.log("Reparenting", this.data)
        let wm = new THREE.Matrix4
        this.el.object3D.updateMatrixWorld()
        wm.copy(this.el.object3D.matrixWorld)
        this.el.object3D.parent.remove(this.el.object3D);
        (document.querySelector('#activated-tool-root') || this.el.sceneEl).object3D.add(this.el.object3D)
        Util.applyMatrix(wm, this.el.object3D)
      }
    },
  },
  emits: {
    resetposition: {}
  },
  init() {
    Util.emitsEvents(this)
    if (this.data.summonable && !this.el.hasAttribute('summonable')) {
      this.el.setAttribute('summonable', 'once: true; activateOnSummon: true')
    }
  },
  resetPosition() {
    if (!this.resetInfo) return;
    if (this.el.is('grabbed')) return;
    this.resetInfo.parentObject.add(this.el.object3D)
    Util.applyMatrix(this.resetInfo.matrix, this.el.object3D)
    this.el.removeState('grab-activated')
    delete this.resetInfo
    this.el.emit('resetposition', this.emitDetails.resetposition)
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

function forwardable(evt) {
  return function(e) {
    if (!this.data.grabElements) return;
    if (!this.data.forwardButtons) return;

    for (let target of Object.values(this.grabbed))
    {
      target.emit(evt, e.detail)
    }
  }
}

AFRAME.registerComponent('selection-box-tool', {
  dependencies: ['six-dof-tool', 'grab-activate'],
  schema: {
    boxSize: {type: 'vec3', default: {x: 0.2, y: 0.2, z: 0.2}},
    selector: {type: 'string', default: '.clickable, .canvas'},
    grabElements: {default: true},
    grabVertices: {default: false},
    selectVertices: {default: false},
    selectElGeometry: {default: true},
    undoable: {default: false},
    duplicateOnGrab: {default: false},
    weight: {default: 0.0},
    autoGrab: {default: true},
    forwardButtons: {default: true},
  },
  events: {
    stateadded: function(e) {
      if (!this.data.autoGrab) return;
      if (e.detail === 'grabbed')
      {
        this.startGrab()
      }
    },
    stateremoved: function(e) {
      if (!this.data.autoGrab) return;
      if (e.detail === 'grabbed')
      {
        this.stopGrab()
      }
    },
    click: function(e) {
      if (!this.data.autoGrab) return;
      this.toggleGrabbing(!this.grabbing)
    },
    bbuttondown: forwardable('bbuttondown'),
    bbuttonup: forwardable('bbuttonup'),
    abuttondown: forwardable('abuttondown'),
    abuttonup: forwardable('abuttonup'),
    xbuttondown: forwardable('xbuttondown'),
    xbuttonup: forwardable('xbuttonup'),
    ybuttondown: forwardable('ybuttondown'),
    ybuttonup: forwardable('ybuttonup'),
  },
  emits: {
    grabstarted: {
      grabbed: null
    },
    grabended: {},
  },
  init() {
    this.el.classList.add('grab-root')
    this.handle = this.el.sceneEl.systems['pencil-tool'].createHandle({radius: 0.07, height: 0.3, parentEl: this.el})
    Pool.init(this)
    Util.emitsEvents(this);

    let box = document.createElement('a-box')
    this.box = box
    box.classList.add('clickable')
    box.setAttribute('material', 'color: #333; shader: matcap; wireframe: true')
    box.setAttribute('axis-handles', '')
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

    if (this.data.selectVertices)
    {
      if (newGrabbing)
      {
        this.el.sceneEl.systems['vertex-handle'].selectors.push(this)
      }
      else
      {
        this.el.sceneEl.systems['vertex-handle'].selectors.splice(this.el.sceneEl.systems['vertex-handle'].selectors.indexOf(this), 1)
      }
    }
  },
  selectPoints(mesh, selectedSet)
  {
    for (let p of Util.meshPointsInContainerMesh(Compositor.mesh, this.box.getObject3D('mesh')))
    {
      selectedSet.add(p)
    }
  },
  selectObjects() {
    let objects = document.querySelectorAll(this.data.selector)
    if (!this.data.grabElements)
    {
      let newObjects = []
      for (let el of objects)
      {
        if (Util.traverseFindAncestor(el, (e) => e === this.el)) continue;
        Util.traverseFindAll(el.object3D, o => o.type === 'Mesh' || o.type === 'SkinnedMesh', {outputArray: newObjects, visibleOnly: true})
      }
      objects = newObjects.map(o => { return {object3D: o}})
    }
    return objects
  },
  preprocessContainedTarget(target) {},
  startGrab() {
    if (this.data.selectVertices) return;

    let objects = this.selectObjects();
    this.grabbers = {}
    this.grabbed = {}
    this.grabberId = {}
    this.grabChildren = {}

    this.box.getObject3D('mesh').geometry.computeBoundingBox()
    let boundingBox = this.box.getObject3D('mesh').geometry.boundingBox

    let worldPos = this.pool('worldPos', THREE.Vector3)
    let localPos = this.pool('localPos', THREE.Vector3)
    for (let el of objects) {
      let target = this.data.grabElements ? Util.resolveGrabRedirection(el) : el

      if (target === this.el) continue
      if (target === this.box) continue
      if (Util.traverseFindAncestor(target, (e) => e === this.el)) continue;
      if (target.object3D.uuid in this.grabbers) continue

      if (this.data.grabElements && this.data.selectElGeometry)
      {
        let contained = false
        if (!el.getObject3D('mesh')) continue;
        if (!Util.visibleWithAncestors(el.object3D)) continue;

        if (!Util.objectsIntersect(el.getObject3D('mesh'), this.box.object3D)) continue
        // Util.traverseFind(el.getObject3D('mesh'), (o) => {
        //   if (!o.geometry) return;
        //
        //   for (let i = 0; i < o.geometry.attributes.position.count; ++i)
        //   {
        //     worldPos.fromBufferAttribute(o.geometry.attributes.position, i)
        //     o.localToWorld(worldPos)
        //     this.box.getObject3D('mesh').worldToLocal(worldPos)
        //     if (boundingBox.containsPoint(worldPos))
        //     {
        //       contained = true
        //       localPos.copy(worldPos)
        //       return true
        //     }
        //   }
        // })
        // if (!contained) continue
      }
      else if (this.data.grabElements)
      {
        if (!Util.visibleWithAncestors(target.object3D)) continue
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
            localPos.copy(worldPos)
            break
          }
        }
        if (!contained) continue
      }

      this.preprocessContainedTarget(target)

      if (this.data.duplicateOnGrab)
      {
        let oldObject = target.object3D
        let newObject = oldObject.clone(true)
        oldObject.parent.add(newObject)
        target.object3D = newObject
      }

      let obj = new THREE.Object3D
      this.box.object3D.add(obj)
      if (this.data.weight > 0.0)
      {
        obj.distanceWeight = THREE.Math.clamp(Math.sqrt(this.data.weight * localPos.length() / this.box.getObject3D('mesh').geometry.boundingSphere.radius), 0.0, 1.0)
      }
      Util.positionObject3DAtTarget(obj, target.object3D)
      this.grabbers[target.object3D.uuid] = obj
      this.grabbed[obj.uuid] = target
      this.grabberId[obj.uuid] = obj

      if (this.data.grabElements)
      {
        target.grabbingManipulator = this
        target.addState('grabbed')
      }

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

    if (Object.keys(this.grabbed).length > 0)
    {
      this.emitDetails.grabstarted.grabbed = this.grabbed
      this.el.emit('grabstarted', this.emitDetails.grabstarted)
    }
  },
  stopGrab() {
    if (this.data.selectVertices) {
      return;
    }
    this.tick = function(){};
    if (this.data.grabElements)
    {
      for (let el of Object.values(this.grabbed))
      {
        delete el.grabbingManipulator
        el.removeState('grabbed')
      }
    }
    if (this.data.duplicateOnGrab && this.grabbing)
    {
      this.toggleGrabbing(false)
    }
    this.el.emit('grabended', this.emitDetails.grabended)
  },
  tick(t,dt) {},
  _tick(t, dt) {
    if (!this.el.is('grabbed') && !this.el.is('autoRotate')) return
    if (!this.grabbing) return

    let interpMat = this.pool('interpMat', THREE.Matrix4)

    for (let obj of Object.values(this.grabbers))
    {
      if (!this.grabbed[obj.uuid] || !this.grabbed[obj.uuid].object3D || !this.grabbed[obj.uuid].object3D.parent)
      {
        console.warn("Grabbed object disappeared", obj)
        delete this.grabbed[obj.uuid]
        continue;
      }

      if (this.data.weight > 0.0)
      {
        // console.log(obj.distanceWeight)
        interpMat.copy(this.grabbed[obj.uuid].object3D.matrix)
        Util.positionObject3DAtTarget(this.grabbed[obj.uuid].object3D, obj)
        Util.interpTransformMatrices(obj.distanceWeight, this.grabbed[obj.uuid].object3D.matrix, interpMat, {result: this.grabbed[obj.uuid].object3D.matrix})
        Util.applyMatrix(this.grabbed[obj.uuid].object3D.matrix, this.grabbed[obj.uuid].object3D)
        // Util.positionObject3DAtTarget(obj, this.grabbed[obj.uuid].object3D)
      }
      else
      {
        Util.positionObject3DAtTarget(this.grabbed[obj.uuid].object3D, obj)
      }

      this.el.sceneEl.systems.manipulator.runConstraints(this.grabbed[obj.uuid], this.pool('localOffset', THREE.Vector3), t, dt)

      //?
      // if (this.grabbed[obj.uuid].manipulatorConstraint) this.grabbed[obj.uuid].manipulatorConstraint(t, dt)

    }
  }
})

const easing = (x) => Math.log(x + 1);
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
    this.el.components['manipulator-weight'].data.weight = THREE.Math.mapLinear(easing(ratio), easing(0), easing(1.0), 0.999, 0.1)
    console.log("Setting weight", this.el.components['manipulator-weight'].data.weight)
  }
})

AFRAME.registerComponent('desk-registration-tool', {
  events: {
    bbuttonup: function(e) {
      this.addPoint()
    },
    click: function(e) {
      this.addPoint()
    }
  },
  init() {
    this.el.classList.add('grab-root')
    this.handle = this.el.sceneEl.systems['pencil-tool'].createHandle({radius: 0.04, height: 0.3, parentEl: this.el})

    let tip = document.createElement('a-entity')
    this.el.append(tip)
    tip.setAttribute('geometry', 'primitive: tetrahedron; radius: 0.02')
    tip.setAttribute('position', `0 -0.3 0`)
    this.tip = tip

    this.el.sceneEl.systems['button-caster'].install(['bbutton'])
    this.points = []
  },
  addPoint() {
    let p
    if (this.points.length >= 3)
    {
      p = this.points.shift()
    }
    else {
      p = new THREE.Vector3()
    }

    this.tip.object3D.getWorldPosition(p)

    this.points.push(p)

    if (this.points.length >= 3)
    {
      this.regress()
    }
    console.log("Desk point", p.toArray())
  },
  regress() {

    let plane = new THREE.Plane();
    plane.setFromCoplanarPoints(...this.points)

    console.log("Aligning to desk", this.points, plane)

    let avg = new THREE.Vector3()

    let target = Compositor.el.object3D
    target.lookAt(plane.normal)
    avg.copy(this.points[0])
    avg.multiplyScalar(1.0 / 3.0)
    avg.addScaledVector(this.points[1], 1.0 / 3.0)
    avg.addScaledVector(this.points[2], 1.0 / 3.0)
    plane.projectPoint(avg, target.position)
    // target.position.worldToLocal(plane.normal)
    // target.position.multiplyScalar(plane.constant)
  }
})

const FORWARD = new THREE.Vector3(0, 0, 1);
AFRAME.registerComponent('straight-edge-tool', {
  dependencies: ['grab-activate', 'six-dof-tool'],
  schema: {
    object: {type: 'selector'},
    lockMostRecentTool: {default: false},
  },
  init() {
    Pool.init(this)
    this.el.setAttribute('geometry', 'primitive: plane; width: 0.03; height: 0.1')
    this.el.setAttribute('material', 'shader: standard; src: #asset-shelf')

    let indicator = document.createElement('a-entity')
    this.el.append(indicator)
    indicator.setAttribute('geometry', 'primitive: plane; width: 0.01; height: 0.1')
    indicator.setAttribute('material', 'shader: standard; src: #asset-shelf; side: double')
    indicator.setAttribute('rotation', '0 90 0')
    indicator.setAttribute('position', '0.015 0 0')

    this.startingPosition = new THREE.Vector3
    this.startingQuaternion = new THREE.Quaternion
    this.plane = new THREE.Plane(new THREE.Vector3(1, 0, 0));
    this.obj = new THREE.Object3D
    this.el.object3D.add(this.obj)

    this.el.classList.add("clickable")

    this.el.sceneEl.systems['manipulator'].installConstraint(this.el, this.moveObj.bind(this))
    this.constraint = this.constraint.bind(this)

    let constraintButton = document.createElement('a-entity')
    this.el.append(constraintButton)
    constraintButton.setAttribute('icon-button', '#asset-lead-pencil')
    constraintButton.setAttribute('tooltip', 'Lock Last Used Tool')
    constraintButton.setAttribute('toggle-button', {component: 'straight-edge-tool', property: 'lockMostRecentTool', target: this.el})
    constraintButton.setAttribute('scale', '0.05 0.05 0.05')
    constraintButton.setAttribute('position', '0 0.032 -0.047')

    let rectifyButton = document.createElement('a-entity')
    this.el.append(rectifyButton)
    rectifyButton.setAttribute('icon-button', '#asset-rotate-3d-variant')
    rectifyButton.setAttribute('tooltip', 'Align Angle')
    rectifyButton.setAttribute('scale', '0.05 0.05 0.05')
    rectifyButton.setAttribute('position', '-0.45 0.0 -0.047')
    rectifyButton.addEventListener('click', () => {
      let r = this.el.getAttribute('rotation')
      const a = 45
      this.el.setAttribute('rotation', `${Math.round(r.x / a) * a} ${Math.round(r.y / a) * a} ${Math.round(r.z / a) * a}`)
    })
  },
  update(oldData) {
    if (this.data.object !== oldData.object)
    {
      if (this.object)
      {
        this.el.sceneEl.systems['manipulator'].removeConstraint(this.object, this.constraint)
        this.ready = false
        this.object = null
      }

      if (this.data.object)
      {
        console.log("Locking", this.data.object)
        this.el.sceneEl.systems['manipulator'].installConstraint(this.data.object, this.constraint)
        this.object = this.data.object
      }
    }

    if (this.data.lockMostRecentTool !== oldData && this.el.sceneEl.systems['pencil-tool'].lastGrabbed)
    {
      if (this.data.lockMostRecentTool)
      {
        this.el.setAttribute('straight-edge-tool', 'object', this.el.sceneEl.systems['pencil-tool'].lastGrabbed.el)
        this.constraint()
      }
      else if (this.object === this.el.sceneEl.systems['pencil-tool'].lastGrabbed.el )
      {
        this.el.setAttribute('straight-edge-tool', 'object', null)
      }
    }
  },
  constraint(t, dt, localOffset)
  {
    if (!this.ready) {
      this.ready = true
      this.startingPosition.copy(this.data.object.object3D.position)
      this.startingQuaternion.copy(this.data.object.object3D.quaternion)

      Util.positionObject3DAtTarget(this.obj, this.data.object.object3D)
      this.plane.constant = 0
      this.plane.constant = - this.el.getAttribute('geometry').width / 2//- this.plane.distanceToPoint(this.obj.position)


    }
    // console.log("straight constraint", this.data.object.object3D.position.toArray(), localOffset.toArray(), this.plane)
    // this.data.object.object3D.position.y = this.startingPosition.y
    // this.data.object.object3D.position.z = this.startingPosition.z
    Util.positionObject3DAtTarget(this.obj, this.data.object.object3D)
    this.startingPosition.copy(this.obj.position)
    this.plane.projectPoint(this.startingPosition, this.obj.position)
    this.obj.quaternion.setFromUnitVectors(FORWARD, this.data.object.components['six-dof-tool'].data.orientation)
    Util.positionObject3DAtTarget(this.data.object.object3D, this.obj)
    // this.data.object.object3D.quaternion.copy(this.startingQuaternion)
  },
  moveObj() {
    if (this.data.object && this.ready)
    {
      Util.positionObject3DAtTarget(this.data.object.object3D, this.obj)
    }
  }
})




AFRAME.registerComponent('lathe-selection-tool', {
  schema: {
    speed: {default: 1.0},
  },
  events: {
    draw: function(e) {
      if (this.el.is('grabbed')) {
        for (let target of Object.values(this.selectionBoxTool.grabbed))
        {
          target.emit('draw', e.detail)
        }
        return;
      }
    },
    triggerdown: function(e) {
      if (this.el.is('grabbed')) {
        for (let target of Object.values(this.selectionBoxTool.grabbed))
        {
          target.emit('triggerdown', e.detail)
        }
        return;
      }
    },
    triggerup: function(e) {
      if (this.el.is('grabbed')) {
        for (let target of Object.values(this.selectionBoxTool.grabbed))
        {
          target.emit('triggerup', e.detail)
        }
        return;
      }
    },
    bbuttondown: function(e) {
      if (!this.selectionBoxTool.grabbing)
      {
        this.clone()
      }
    },
    click: function(e) {
      if (this.el.is('grabbed') && this.selectionBoxTool.grabbing) {
        for (let target of Object.values(this.selectionBoxTool.grabbed))
        {
          target.emit('click', e.detail)
        }
        return;
      }
      if (!this.el.is('autoRotate'))
      {
        this.selectionBoxTool.toggleGrabbing(true)
        this.selectionBoxTool.startGrab()
        this.el.addState('autoRotate')
      }
      else
      {
        this.el.removeState('autoRotate')
        this.selectionBoxTool.stopGrab()
        this.selectionBoxTool.toggleGrabbing(false)
      }
    }
  },
  init() {
    this.el.setAttribute('selection-box-tool', 'boxSize: 0.4 0.1 0.4; autoGrab: false')
    this.el.setAttribute('action-tooltips', 'trigger: Toggle Lathe; b: Clone')
    let lever = document.createElement('a-entity')
    this.el.append(lever)
    lever.setAttribute('position', '0.02 -0.2 0')
    lever.setAttribute('scale', '0.6 0.6 0.6')
    lever.setAttribute('lever', {target: this.el, component: 'lathe-selection-tool', property: 'speed', axis: 'x', gripRadius: 0.07, handleLength: 0.3, valueRange: new THREE.Vector2(20, -20), initialValue: 1.0})
    Util.whenComponentInitialized(this.el, 'selection-box-tool', () => {
      this.selectionBoxTool = this.el.components['selection-box-tool']
      this.box = this.selectionBoxTool.box
    })
  },
  clone() {
    let el = document.createElement('a-entity')
    this.el.object3D.parent.el.append(el)
    Util.whenLoaded(el, () => {
      Util.positionObject3DAtTarget(el.object3D, this.el.object3D)
      el.setAttribute('lathe-selection-tool', this.el.getAttribute('lathe-selection-tool'))
    })
  },
  tick(t, dt) {
    if (!this.box) return;
    if (!this.selectionBoxTool.grabbing) return;
    this.box.object3D.rotateY(this.data.speed / 1000.0 * dt)
  }
})

AFRAME.registerComponent('delete-box-tool', {
  dependencies: ['selection-box-tool'],
  schema: {},
  events: {
    grabstarted: function(e){
      if (!this.el.components['selection-box-tool'].grabbing) return;

      this.selectionBoxTool.toggleGrabbing(false)

      let grabbed = Object.values(e.detail.grabbed)
      Undo.collect(() => {
        for (let el of Object.values(grabbed))
        {
          let originalMesh = el.getObject3D('mesh')
          let originalParent = el.object3D.parent.el
          let type = ['primitive-construct-placeholder', 'reference-glb'].find(c => el.hasAttribute(c))
          let m = new THREE.Matrix4().copy(el.object3D.matrix)
          Undo.push(() => {
            let newEl = document.createElement('a-entity')
            originalParent.append(newEl)
            console.log("Restoring", newEl)

            Util.whenLoaded(newEl, () => {
              originalMesh.el = newEl
              newEl.setObject3D('mesh', originalMesh)
              newEl.setAttribute(type, type === 'reference-glb' ? '' : 'detached: true; manualMesh: true')
              Util.applyMatrix(m, newEl.object3D)
            })
          })
        }
      })
      for (let el of Object.values(e.detail.grabbed))
      {
        el.setObject3D('mesh', new THREE.Object3D)
        el.parentEl.removeChild(el)
        // Util.disposeEl(el)
      }
    }
  },
  init() {
    Util.whenComponentInitialized(this.el, 'selection-box-tool', () => {
      this.el.setAttribute('selection-box-tool', 'selector', 'a-entity[primitive-construct-placeholder], a-entity[reference-glb]')
      this.selectionBoxTool = this.el.components['selection-box-tool']
      this.box = this.selectionBoxTool.box

      let handle = this.selectionBoxTool.handle
      handle.setAttribute('material', 'color', 'red')
      handle.setAttribute('material', 'src', '')
      this.box.setAttribute('material', 'color', 'red')
    })
  },
})

AFRAME.registerComponent('reparent-tool', {
  dependencies: ['selection-box-tool'],
  schema: {},
  events: {
    grabstarted: function(e){
      if (!this.el.components['selection-box-tool'].grabbing) return;

      this.selectionBoxTool.toggleGrabbing(false)

      let grabbed = Object.values(e.detail.grabbed)
      this.reparent(grabbed)
      if (grabbed.length > 0)
      {
        Sfx.recognition(this.el)
      }
    },
    startobjectconstraint: function(e) {
      let el = e.detail.el
      console.log("Selected parent", el)
      this.selectedParent = el
    },
    endobjectconstraint: function(e) {
      this.selectedParent = null
    }
  },
  init() {
    let flag = this.flag = this.el.sceneEl.systems['pencil-tool'].createConnectedFlag(this.el, {selector: PARENTABLE_TARGETS})
    flag.setAttribute('preactivate-tooltip', 'Parent Selector')
    Util.whenComponentInitialized(this.el, 'selection-box-tool', () => {
      this.selectionBoxTool = this.el.components['selection-box-tool']
    })
  },
  reparent(grabbed)
  {
    let newParent
    let toolRoot = this.el.sceneEl.querySelector('#activated-tool-root')
    let shapeRoot = this.el.sceneEl.querySelector('#shape-root')
    let referenceRoot = this.el.sceneEl.querySelector('#reference-spawn')
    for (let el of grabbed)
    {
      if (this.selectedParent && !Util.traverseFindAncestor(this.selectedParent.object3D, o => o === el.object3D))
      {
        newParent = this.selectedParent.object3D
      }
      else if (el.hasAttribute('six-dof-tool'))
      {
        newParent = toolRoot.object3D
      }
      else if (el.hasAttribute('primitive-construct-placeholder'))
      {
        newParent = shapeRoot.object3D
      }
      else if (el.hasAttribute('reference-glb'))
      {
        newParent = referenceRoot.object3D
      }
      else
      {
        console.warn("Don't know where to put", el)
        continue;
      }

      Util.keepingWorldPosition(el.object3D, () => {
        newParent.add(el.object3D)
      })
    }
  }
})

AFRAME.registerComponent('knife-pencil-tool', {
  events: {
    startdrawing: function(e) {

    }
  }
})
