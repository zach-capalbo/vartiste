import {Sfx} from './sfx.js'
import {Util} from './util.js'
import {Pool} from './pool.js'
import Color from "color"
import {Brush} from './brush.js'
import {BrushList} from './brush-list.js'
import {Undo} from './undo.js'
import {SNAP_PRIORITY} from './manipulator.js'

const DEFAULT_SELECTOR = "a-entity[six-dof-tool], a-entity.clickable[reference-glb], a-entity.clickable[primitive-construct-placeholder], a-entity.canvas[composition-view], a-entity[flaggable-manipulator], a-entity[flaggable-control]"
const TOOLS_ONLY_SELECTOR = "a-entity[six-dof-tool], a-entity[flaggable-manipulator]"
const SHAPES_AND_REFERENCED = "a-entity[reference-glb], a-entity[primitive-construct-placeholder]"
export const ALL_MESHES = "a-entity[reference-glb], a-entity[primitive-construct-placeholder], a-entity[composition-view]"
const ALL_MESHES_AND_CANVAS = ALL_MESHES + ", a-entity.canvas"
export const PARENTABLE_TARGETS = 'a-entity.clickable[reference-glb], a-entity.clickable[primitive-construct-placeholder], a-entity[bone-redirector]'

AFRAME.registerComponent('flaggable-control', {})

AFRAME.registerComponent('adjustable-origin', {
  schema: {
    target: {type: 'selector'},
  },
  events: {
    stateremoved: function (e) {
      if (e.target !== this.handle) return;
      if (e.detail !== 'grabbed') return;
      this.setOrigin()
    }
  },
  init() {
    let handle = this.handle = document.createElement('a-entity')
    this.el.append(handle)
    handle.setAttribute('grabbable', '')

    Util.whenLoaded(handle, () => {
      handle.object3D.userData.vartisteUI = true
      let obj = new THREE.Group;
      let s1 = 2.0;
      let s2 = 0.05;
      let x = new THREE.Mesh(new THREE.BoxGeometry(s1, s2, s2), new THREE.MeshBasicMaterial({color: 'red'}))
      let y = new THREE.Mesh(new THREE.BoxGeometry(s2, s1, s2), new THREE.MeshBasicMaterial({color: 'green'}))
      let z = new THREE.Mesh(new THREE.BoxGeometry(s2, s2, s1), new THREE.MeshBasicMaterial({color: 'blue'}))
      obj.add(x)
      obj.add(y)
      obj.add(z)
      obj.el = handle
      handle.setObject3D('mesh', obj)
    })
  },
  remove() {
    console.log("Removing origin handle")
    this.handle.object3D.parent.remove(this.handle.object3D)
    Util.disposeEl(this.handle)
  },
  update(oldData) {
    console.log("Updating adjustable-origin", this.data.target, this.oldData)
    if (!this.data.target) this.data.target = this.el
    if (this.data.target !== oldData.target)
    {
      Util.whenLoaded(this.handle, () => {
        if (!this.data.target) return;
        let targetParent = this.data.target.object3D || this.data.target;
        console.log("Reparenting handle", this.handle.object3D, targetParent);
        if (this.handle.object3D.parent) this.handle.object3D.parent.remove(this.handle.object3D)
        targetParent.add(this.handle.object3D)
      })
    }
  },
  setOrigin() {
    if (!this.data.target) return;
    let obj = this.data.target.object3D || this.data.target
    Util.setObject3DOriginAtTarget(obj, this.handle.object3D)
    this.el.emit('originmoved', {})
  }
})

Util.registerComponentSystem('decorator-flag-system', {
  init() {
    this.el.sceneEl.systems['button-caster'].install(['ybutton'])
  }
})

AFRAME.registerComponent('decorator-flag', {
  dependencies: ['six-dof-tool', 'grab-activate'],
  schema: {
    selector: {type: 'string', default: DEFAULT_SELECTOR},
    reparent: {default: true},
    icon: {type: 'string'},
    color: {type: 'color', default: '#b6c5f2'},
    resolveProxy: {default: false},
  },
  emits: {
    startobjectconstraint: {
      el: null,
      intersectionInfo: null
    },
    endobjectconstraint: {
      el: null
    },
    cloneloaded: {
      el: null
    }
  },
  events: {
    stateremoved: function(e) {
      if (e.detail === 'grabbed') {
        this.attachToTool()
      }
    },
    stateadded: function(e) {
      if (e.detail === 'grabbed') {
        this.grabbedBy = this.el.grabbingManipulator ? this.el.grabbingManipulator.el : null
        this.detachTool()
      }
    },
    activate: function(e) {
      this.makeClone({leaveAtParent: true})
    },
    bbuttondown: function(e) {
      if (this.el.is('grabbed'))
      {
        this.makeClone()
      }
    },
    ybuttondown: function(e) {
      if (this.el.is('grabbed'))
      {
        this.makeClone()
      }
    },
    resetposition: function(e) {
      this.detachTool()
    },
  },
  init() {
    this.system = this.el.sceneEl.systems['decorator-flag-system']
    Pool.init(this, {useSystem: true})
    Util.emitsEvents(this)

    this.el.classList.add('grab-root')
    this.handle = document.createElement('a-entity')
    this.el.append(this.handle)
    this.handle.classList.add("clickable")
    this.handle.setAttribute('propogate-grab','')
    // this.handle.setAttribute('geometry', 'primitive: cone; radius: 0.05; radiusTubular: 0.01; segmentsRadial: 8; segmentsTubular: 16')
    let needleLength = 0.3;
    this.handle.setAttribute('geometry', `primitive: cone; radiusBottom: 0.02; radiusTop: 0.001; segmentsRadial: 4; segmentsHeight: 1; height: ${needleLength}`)
    this.handle.setAttribute('material', 'shader: matcap; color: #96A2B0')
    this.handle.setAttribute('rotation', '-90 0 0')
    this.label = document.createElement('a-entity')
    this.el.append(this.label)
    this.label.setAttribute('geometry', 'primitive: flag; width: 0.1; height: 0.1; depth: 0.001')
    this.label.setAttribute('material', 'shader: matcap; color: #b6c5f2')
    this.label.setAttribute('position', `0 0 ${needleLength / 2}`)
    this.label.classList.add("clickable")
    this.label.setAttribute('propogate-grab','')
    this.el.setAttribute('action-tooltips', "b: Clone")
    this.placeholder = new THREE.Object3D;

    // this.icon = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.1), new THREE.MeshBasicMaterial({transparent: true}))
    let icon = this.icon = document.createElement('a-entity')
    this.el.append(icon)
    icon.setAttribute('geometry', 'primitive: plane; width: 0.09; height: 0.09')
    icon.setAttribute('material', 'shader: flat; transparent: true')
    icon.setAttribute('position', `0 0 ${needleLength / 2 + 0.005}`)

    this.manipulatorGrabStart = this.manipulatorGrabStart.bind(this)
    this.manipulatorGrabEnd = this.manipulatorGrabEnd.bind(this)

    Util.whenLoaded(this.el, () => {
      this.el.object3D.userData.vartisteUI = true
    })
  },
  update(oldData) {
    this.label.setAttribute('material', 'color', this.data.color)
    if (this.data.icon)
    {
      this.icon.setAttribute('visible', true)
      this.icon.setAttribute('material', 'src', this.data.icon)
    }
    else
    {
      this.icon.setAttribute('visible', false)
    }
  },
  attachToTool() {
    if (this.attachedTo) return;
    let intersectionInfo = this.pool('intersectionInfo', Object)

    document.querySelectorAll(this.data.selector).forEach(el => {
      if (this.attachedTo) return;
      if (el === this.el) return;
      if (!Util.visibleWithAncestors(el.object3D)) return;
      if (el.hasAttribute('decorator-flag')) return;
      if (!Util.objectsIntersect(this.handle.object3D, el.object3D, {intersectionInfo})) return;
      if (el === this.grabbedBy) return;
      if (intersectionInfo.objectB.el && intersectionInfo.objectB.el !== el && intersectionInfo.objectB.el.matches(this.data.selector)) return;

      console.log("Intersecting tool", el, intersectionInfo)
      if (this.data.reparent)
      {
        let placeholder = this.placeholder
        el.object3D.add(placeholder)
        Util.positionObject3DAtTarget(placeholder, this.el.object3D)
        el.object3D.add(this.el.object3D)
        Util.positionObject3DAtTarget(this.el.object3D, placeholder)
        el.object3D.remove(placeholder)
      }

      if (el.hasAttribute('flaggable-manipulator'))
      {
        this.attachManipulator(el);
        return;
      }

      this.attachTo(el, intersectionInfo)
    })
  },
  detachTool() {
    if (this.attachedTo || this.attachedManipulator)
    {
      if (this.attachedManipulator)
      {
        this.detachManipulator();
      }

      let placeholder = this.placeholder
      this.el.sceneEl.object3D.add(placeholder)
      Util.positionObject3DAtTarget(placeholder, this.el.object3D)
      ;(document.querySelector('#world-root') || this.el.sceneEl).object3D.add(this.el.object3D);
      Util.positionObject3DAtTarget(this.el.object3D, placeholder)

      if (this.attachedTo)
      {
        this.detachFrom()
      }
    }
  },
  makeClone({leaveAtParent = false} = {}) {
    let el = document.createElement('a-entity')
    if (this.el.attachedTo || leaveAtParent)
    {
      this.el.parentEl.append(el)
    }
    else
    {
      this.el.sceneEl.append(el)
    }
    Util.whenLoaded(el, () => {
      this.emitDetails.cloneloaded.el = el
      this.el.emit('cloneloaded', this.emitDetails.cloneloaded)
      Util.positionObject3DAtTarget(el.object3D, this.el.object3D)
      if (!leaveAtParent)
      {
        Util.whenComponentInitialized(el, 'decorator-flag', () => {
          Util.whenLoaded(el.components['decorator-flag'].handle, () => {
            Util.delay(100).then(() => {
              console.log("Constraint Clone initialized")
              el.components['decorator-flag'].attachToTool()
            })
          })
        })
      }
    })
  },
  attachTo(el, intersectionInfo) {
    if (this.data.resolveProxy && el.hasAttribute('grab-redirector'))
    {
      let target = el.getAttribute('grab-redirector').target
      if (target.object3D)
      {
        el = target
      }
      else
      {
        el = {object3D: target}
      }
    }

    this.attachedTo = el
    this.emitDetails.startobjectconstraint.el = el
    this.emitDetails.startobjectconstraint.intersectionInfo = intersectionInfo
    this.el.emit('startobjectconstraint', this.emitDetails.startobjectconstraint)

    if (!this.attachedManipulator)
    {
      Sfx.stickOn(this.el, {volume: 0.1})
    }
  },
  detachFrom() {
    if (this.attachedTo)
    {
      this.emitDetails.endobjectconstraint.el = this.attachedTo
      this.el.emit('endobjectconstraint', this.emitDetails.endobjectconstraint)
    }

    this.attachedTo = undefined

    if (!this.attachedManipulator)
    {
      Sfx.stickOff(this.el, {volume: 0.05})
    }
  },
  canTransferGrab(el) {
    if (el.hasAttribute('decorator-flag')) return false;
    return el.matches(this.data.selector);
  },
  manipulatorGrabStart(e) {
    if (e.detail !== 'grabbing') return;
    if (this.canTransferGrab(this.attachedManipulator.components.manipulator.target))
    {
      this.attachTo(this.attachedManipulator.components.manipulator.target)
    }
  },
  manipulatorGrabEnd(e) {
    if (e.detail !== 'grabbing') return;
    this.detachFrom()
  },
  attachManipulator(el) {
    if (this.attachedManipulator) return;
    el.addEventListener('stateadded', this.manipulatorGrabStart)
    el.addEventListener('stateremoved', this.manipulatorGrabEnd)
    this.attachedManipulator = el;

    if (this.attachedManipulator.components.manipulator.target && this.canTransferGrab(this.attachedManipulator.components.manipulator.target))
    {
      this.attachTo(this.attachedManipulator.components.manipulator.target)
    }

    Sfx.stickOn(this.el, {volume: 0.1})
  },
  detachManipulator() {
    this.attachedManipulator.removeEventListener('stateadded', this.manipulatorGrabStart)
    this.attachedManipulator.removeEventListener('stateremoved', this.manipulatorGrabEnd)
    this.attachedManipulator = null
  }
})

function cloneloaded(e) {
  e.stopPropagation()
  e.detail.el.setAttribute(this.attrName, this.el.getAttribute(this.attrName))
}

AFRAME.registerComponent('flaggable-manipulator', {
  init() {}
})

AFRAME.registerComponent('weight-constraint-flag', {
  dependencies: ['decorator-flag'],
  schema: {
    weight: {default: 0.9}
  },
  events: {
    startobjectconstraint: function(e) {
      let el = e.detail.el
      if (!el['tool-weight-tool-data'])
      {
        el['tool-weight-tool-data'] = {
          originalWeight: el.hasAttribute('manipulator-weight') ? AFRAME.utils.clone(el.getAttribute('manipulator-weight')) : null,
          weightCount: 0,
        }
      }

      el['tool-weight-tool-data'].weightCount++;

      el.setAttribute('manipulator-weight', `weight: ${this.calcWeight(el['tool-weight-tool-data'].weightCount)}; type: slow`)    },
    endobjectconstraint: function(e) {
      let el = e.detail.el;

      el['tool-weight-tool-data'].weightCount--;

      if (el['tool-weight-tool-data'].weightCount === 0)
      {
        if (el['tool-weight-tool-data'].originalWeight)
        {
          el.setAttribute('manipulator-weight', el['tool-weight-tool-data'].originalWeight)
        }
        else
        {
          el.removeAttribute('manipulator-weight')
        }
        delete el['tool-weight-tool-data'];
      }
      else
      {
        el.setAttribute('manipulator-weight', `weight: ${this.calcWeight(el['tool-weight-tool-data'].weightCount)}; type: slow`)
      }
    },
    cloneloaded: cloneloaded,
  },
  init() {
    this.el.setAttribute('decorator-flag', {icon: '#asset-hand-two-lines', color: '#867555'})
  },
  calcWeight(count) {
    let c = 0
    for (let i = 1; i <= count; i++)
    {
      c += 1 / Math.pow(2, i)
    }
    return c;
  },
})

AFRAME.registerComponent('remember-position-flag', {
  dependencies: ['decorator-flag'],
  events: {
    startobjectconstraint: function(e) {
      let el = e.detail.el;
      let positioner = new THREE.Object3D;
      this.el.sceneEl.object3D.add(positioner)
      Util.positionObject3DAtTarget(positioner, el.object3D)
      this.positionerMap.set(el, positioner)
    },
    endobjectconstraint: function(e) {
      let el = e.detail.el;
      let positioner = this.positionerMap.get(el)
      if (!positioner) return;
      Util.positionObject3DAtTarget(el.object3D, positioner)
      positioner.parent.remove(positioner)
      this.positionerMap.delete(el)
    },
    cloneloaded: cloneloaded,
  },
  init() {
    this.el.setAttribute('decorator-flag', {icon: '#asset-ear-hearing'})
    this.positionerMap = new Map;
  }
})

AFRAME.registerComponent('show-normals-flag', {
  dependencies: ['decorator-flag'],
  events: {
    startobjectconstraint: function(e) {
      let el = e.detail.el
      Util.traverseNonUI(el.object3D, (o) => {
        if (!o.material) return;
        if (o.material.isMeshNormalMaterial) return;

        this.meshMap.set(o, o.material)
        o.material = this.normalMaterial
      })
    },
    endobjectconstraint: function(e) {
      let el = e.detail.el
      Util.traverseNonUI(el.object3D, (o) => {
        if (!o.material) return;
        if (!o.material.isMeshNormalMaterial) return;

        let m = this.meshMap.get(o)
        if (m) {
          o.material = m
          this.meshMap.delete(o)
        }
      })
    },
    cloneloaded: cloneloaded,
  },
  init() {
    this.el.setAttribute('decorator-flag', {color: '#b435ba', icon: '#asset-brightness-4'})
    this.meshMap = new Map();
    this.normalMaterial = new THREE.MeshNormalMaterial()
  }
})

AFRAME.registerComponent('show-uv-flag', {
  dependencies: ['decorator-flag'],
  events: {
    startobjectconstraint: async function(e) {
      let el = e.detail.el
      let m = await this.getMaterial()
      m.needsUpdate = true
      Util.traverseNonUI(el.object3D, (o) => {
        if (!o.material) return;
        if (o.material === m) return

        this.meshMap.set(o, o.material)
        o.material = m
      })
    },
    endobjectconstraint: function(e) {
      let el = e.detail.el
      Util.traverseNonUI(el.object3D, (o) => {
        if (!o.material) return;

        let m = this.meshMap.get(o)
        if (m) {
          o.material = m
          this.meshMap.delete(o)
        }
      })
    },
    cloneloaded: cloneloaded,
  },
  init() {
    this.el.setAttribute('decorator-flag', {color: '#b435ba', icon: '#asset-brush'})
    this.meshMap = new Map();
  },
  async getMaterial() {
    if (this._material) return this._material;

    let canvas = document.createElement('canvas')
    Util.ensureSize(canvas, 1024, 1024)
    this.el.sceneEl.systems['canvas-fx'].applyFX('show-uv', canvas)
    let tex = new THREE.Texture(canvas)
    let matcapKey = Object.keys(this.el.sceneEl.systems['material'].textureCache).find(o => o.includes(this.el.sceneEl.querySelector('#asset-matcap').src))
    let matcapMap = await this.el.sceneEl.systems.material.textureCache[matcapKey]

    console.log("Setting up show uv", tex, matcapMap)
    let material = new THREE.MeshBasicMaterial({map: tex, matcap: matcapMap})//{map: tex, matcap: matcapMap})
    this._material = material;
    tex.needsUpdate = true
    return material;
  }
})

AFRAME.registerComponent('wireframe-flag', {
  dependencies: ['decorator-flag'],
  events: {
    startobjectconstraint: function(e) {
      let el = e.detail.el
      el.classList.remove('clickable')
      Util.traverseNonUI(el.object3D, (o) => {
        if (!o.material) return;

        if (this.meshMap.has(o.material)) return;
        this.meshMap.set(o.material, o.material.wireframe)
        o.material.wireframe = true
        o.material.needsUpdate = true
      })
    },
    endobjectconstraint: function(e) {
      let el = e.detail.el
      el.classList.add('clickable')
      Util.traverseNonUI(el.object3D, (o) => {
        if (!o.material) return;

        let m = this.meshMap.get(o.material)
        if (this.meshMap.has(o.material)) {
          o.material.wireframe = m
          o.material.needsUpdate = true
          this.meshMap.delete(o.material)
          if (m) {
            console.log("Leaving as wireframe", o, m)
          }
        }
      })
    },
    cloneloaded: cloneloaded,
  },
  init() {
    this.el.setAttribute('decorator-flag', {color: '#b435ba', icon: '#asset-web'})
    this.meshMap = new Map();
  }
})

AFRAME.registerComponent('unclickable-flag', {
  dependencies: ['decorator-flag'],
  events: {
    startobjectconstraint: function(e) {
      Util.traverseEl(e.detail.el, (el) => {
        this.elMap.set(el, el.classList.contains('clickable'))
        el.classList.remove('clickable')
      })
      this.el.setAttribute('decorator-flag', 'color', '#ff5555')
    },
    endobjectconstraint: function(e) {
      Util.traverseEl(e.detail.el, (el) => {
        if (this.elMap.get(el))
        {
          el.classList.add('clickable')
        }
        this.elMap.delete(el)
      })

      this.el.setAttribute('decorator-flag', 'color', '#867555')
    },
    cloneloaded: cloneloaded,
  },
  init() {
    this.el.setAttribute('decorator-flag', {color: '#867555', icon: '#asset-hand-no-lines'})
    this.elMap = new Map();
  }
})

AFRAME.registerComponent('axis-handles-flag', {
  dependencies: ['decorator-flag'],
  events: {
    startobjectconstraint: function(e) {
      let el = e.detail.el
      el.setAttribute('axis-handles', el.hasAttribute('primitive-shape-construct') ? 'apply: true' : '')
    },
    endobjectconstraint: function(e) {
      e.detail.el.removeAttribute('axis-handles')
    },
    cloneloaded: cloneloaded,
  },
  init() {
    this.el.setAttribute('decorator-flag', {icon: '#asset-resize', color: '#313baa'})
  }
})

AFRAME.registerComponent('trigger-down-flag', {
  dependencies: ['decorator-flag'],
  schema: {
    throttle: {default: 50},
  },
  startobjectconstraint: function(e) {
    let el = e.detail.el
    el.addState('grabbed')
    this.attachedTo = el
    el.emit('triggerdown', {})
  },
  endobjectconstraint: function(e) {
    let el = e.detail.el
    el.emit('triggerup', {})
    delete this.attachedTo
    el.removeState('grabbed')
  },
  init() {
    this.tick = AFRAME.utils.throttleTick(this.tick, this.data.throttle, this)
    this.params = {pressure: 1.0, rotation: 0.0, sourceEl: this.el, distance: 0, scale: 1.0}
  },
  tick(t, dt)
  {
    if (!this.attachedTo) return;
    this.attachedTo.emit('draw', this.params)
  }
})

AFRAME.registerComponent('log-to-console-flag', {
  dependencies: ['decorator-flag'],
  events: {
    startobjectconstraint: function(e) {
      console.info("Flagged:", e.detail.el, e.detail.intersectionInfo.objectB)
    }
  },
  init() {
    this.el.setAttribute('decorator-flag', 'color: #282828; icon: #asset-translate')
  }
})

AFRAME.registerComponent('inspector-flag', {
  schema: {
    subObject: {default: false},
  },
  dependencies: ['decorator-flag'],
  events: {
    startobjectconstraint: function(e) {
      let view = this.el.sceneEl.systems['scene-organizer'].inspect(e.detail.el)
      view['redirect-grab'] = this.el
      Util.whenLoaded(view, () => {
        Util.positionObject3DAtTarget(view.object3D, this.positioner)
      })
      console.info("Inpsecting", e.detail.el)
    },
    endobjectconstraint: function(e) {
      let view = this.el.sceneEl.systems['scene-organizer'].viewFor(e.detail.el)
      if (!view) return;
      delete view['redirect-grab'];
      view.components['frame'].closeFrame()
    },
    cloneloaded: cloneloaded,
  },
  init() {
    this.el.setAttribute('decorator-flag', 'icon: #asset-newspaper-variant-outline; resolveProxy: true')
    let positioner = this.positioner = new THREE.Object3D;
    this.el.object3D.add(positioner)
    positioner.position.set(0, 0.1, 0.16)
    positioner.scale.set(0.1, 0.1, 0.1)
  },
})

AFRAME.registerComponent('restart-animation-on-grab-flag', {
  dependencies: ['decorator-flag'],
  events: {
    startobjectconstraint: function(e) {
      if (Compositor.component.isPlayingAnimation)
      {
        Compositor.component.jumpToFrame(0)
      }
    },
    endobjectconstraint: function(e) {
      if (Compositor.component.isPlayingAnimation)
      {
        Compositor.component.jumpToFrame(0)
      }
    }
  },
  init() {
    this.el.setAttribute('decorator-flag', 'color: #282828; icon: #asset-translate')
  }
})

AFRAME.registerComponent('dynamic-body-flag', {
  dependencies: ['decorator-flag'],
  events: {
    startobjectconstraint: function(e) {
      let el = e.detail.el
      if (this.decorator.attachedManipulator)
      {
        el.setAttribute('physx-body', 'type: kinematic')
      }
      else
      {
        el.setAttribute('physx-body', 'type: dynamic')
      }
    },
    endobjectconstraint: function(e) {
      let el = e.detail.el
      if (this.decorator.attachedManipulator)
      {
        el.setAttribute('physx-body', 'type: dynamic')
      }
      else
      {
        el.setAttribute('physx-body', 'type: kinematic')
      }
    },
    activate: function(e) {
      if (!this.el.sceneEl.systems.physx.physXInitialized)
      {
        this.el.sceneEl.setAttribute('art-physics', {scenePhysics: true})
      }
    },
    cloneloaded: cloneloaded,
  },
  init() {
    this.el.setAttribute('decorator-flag', 'color: #308a5f; icon: #asset-cube-send')
    this.decorator = this.el.components['decorator-flag']
  }
})

AFRAME.registerComponent('ray-snap-flag', {
  dependencies: ['decorator-flag'],
  schema: {
    emitEvents: {default: false},
    distance: {default: 0.4},
    selector: {default: ALL_MESHES_AND_CANVAS},
  },
  events: {
    startobjectconstraint: function(e) {
      let el = e.detail.el
      this.refreshObjects()
      this.elConstraint.set(el, this.el.sceneEl.systems.manipulator.installConstraint(el, this.constrainObject.bind(this, el), SNAP_PRIORITY))
      this.line.visible = true
      el.addEventListener('stateadded', this.refreshObjects)
    },
    endobjectconstraint: function(e) {
      let el = e.detail.el
      this.el.sceneEl.systems.manipulator.removeConstraint(el, this.elConstraint.get(el))
      this.elConstraint.delete(el)
      this.line.visible = false
      el.removeEventListener('stateadded', this.refreshObjects)
    },
    cloneloaded: cloneloaded,
  },
  emits: {
    snapped: {
      el: null,
      to: null,
      toEl: null,
      point: new THREE.Vector3()
    },
    unsnapped: {
      el: null,
    }
  },
  init() {
    this.el.setAttribute('decorator-flag', 'color: #867555; icon: #asset-nudge-brush')

    Pool.init(this)
    this.refreshObjects = this.refreshObjects.bind(this)
    Util.emitsEvents(this)

    let lineGeometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,0,0), new THREE.Vector3(0, 0, -this.data.distance)])
    this.line = new THREE.Line(lineGeometry, new THREE.LineBasicMaterial({color: 'green'}))
    this.el.object3D.add(this.line)

    let lineIndicator = new THREE.Mesh(new THREE.IcosahedronGeometry(0.004, 0), new THREE.MeshBasicMaterial({color: 'green', depthTest: false, transparent: true}))
    this.line.add(lineIndicator)
    this.line.visible = false

    this.positioner = new THREE.Object3D
    this.el.sceneEl.object3D.add(this.positioner)

    this.elConstraint = new Map()
  },
  refreshObjects() {
    this.elList = Array.from(this.el.sceneEl.querySelectorAll(this.data.selector))
  },
  constrainObject(el, t, dt, localOffset) {
    let worldScale = this.pool('worldScale', THREE.Vector3)
    this.el.object3D.getWorldScale(worldScale)
    let raycaster = this.pool('raycaster', THREE.Raycaster)
    raycaster.ray.direction.set(0, 0, -1);
    raycaster.far = worldScale.z * this.data.distance;
    raycaster.firstHitOnly = true;
    this.el.object3D.getWorldPosition(raycaster.ray.origin)
    let worldQuat = this.pool('worldQuat', THREE.Quaternion)
    this.el.object3D.getWorldQuaternion(worldQuat)
    raycaster.ray.direction.applyQuaternion(worldQuat)
    let hits = []
    let minDistance = raycaster.far
    let minHit = null
    let minEl = null
    for (let targetEl of this.elList)
    {
      if (!Util.visibleWithAncestors(targetEl.object3D)) continue;
      if (targetEl === el) continue;
      hits.length = 0
      raycaster.intersectObject(targetEl.getObject3D('mesh') || targetEl.object3D, true, hits)
      if (hits.length > 0 && hits[0].distance < minDistance)
      {
        minDistance = hits[0].distance
        minHit = hits[0]
        minEl = targetEl
      }
    }

    if (minHit)
    {
      let root = el.object3D.parent
      let localOrigin = this.pool('localOrigin', THREE.Vector3)
      localOrigin.copy(raycaster.ray.origin)
      root.worldToLocal(localOrigin)
      let localHit = this.pool('localHit', THREE.Vector3)
      localHit.copy(minHit.point)
      root.worldToLocal(localHit)
      localHit.sub(localOrigin)
      el.object3D.position.add(localHit)

      if (this.data.emitEvents && this.lastSnapped !== minHit.object)
      {
        this.emitDetails.snapped.el = el
        this.emitDetails.snapped.to = minHit.object
        this.emitDetails.snapped.toEl = minEl
        this.emitDetails.snapped.point = minHit.point
        this.lastSnapped = minHit.object
        this.el.emit('snapped', this.emitDetails.snapped)
      }
      return;
    }

    if (this.data.emitEvents && this.lastSnapped)
    {
      this.lastSnapped = null
      this.emitDetails.unsnapped.el = el
      this.el.emit('unsnapped', this.emitDetails.unsnapped)
    }
  }
})

// TODO: Snap to parent, set origin to line origin
AFRAME.registerComponent('ray-snap-to-parent-flag', {
  dependencies: ['ray-snap-flag'],
  events: {
    cloneloaded: cloneloaded,
    startobjectconstraint: function(e) {
      let el = e.detail.el
      console.log("Start object constraint", e)
      el.addEventListener('stateadded', this.stateadded)
      el.addEventListener('stateremoved', this.stateremoved)
    },
    endobjectconstraint: function(e) {
      let el = e.detail.el
      el.removeEventListener('stateadded', this.stateadded)
      el.removeEventListener('stateremoved', this.stateremoved)
      if (el.is('snappedtoparent'))
      {
        el.removeState('snappedtoparent')
        el.removeAttribute('manipulator-lock')
      }
    },
    snapped: function(e) {
      console.log("Snapped", e)
      this.newParentEl = e.detail.toEl
    },
    unsnapped: function(e) {
      console.log("Unsnapped")
      this.newParentEl = null
    }
  },
  init() {
    this.el.setAttribute('ray-snap-flag', `emitEvents: true; selector: ${PARENTABLE_TARGETS}`)
    this.el.setAttribute('decorator-flag', 'color: #b6c5f2')
    this.stateadded = this.stateadded.bind(this)
    this.stateremoved = this.stateremoved.bind(this)
  },
  stateadded(e) {
    if (e.detail !== 'grabbed') return;
    let el = e.target
  },
  stateremoved(e) {
    if (e.detail !== 'grabbed') return;
    console.log("Stateremoved", e, this.newParentEl)
    let el = e.target
    let newParentEl = this.newParentEl// ? Util.resolveGrabRedirection(this.newParentEl) : null

    if (newParentEl && newParentEl.hasAttribute('grab-redirector'))
    {
      console.log("resolving redirector")
      let target = newParentEl.getAttribute('grab-redirector').target
      if (target.object3D)
      {
        newParentEl = target
      }
      else
      {
        newParentEl = {object3D: target}
      }
    }

    if (el.is('snappedtoparent')) return;

    if (newParentEl)
    {
      console.log("Reparenting", el, newParentEl)
      Util.keepingWorldPosition(el.object3D, () => {
        newParentEl.object3D.add(el.object3D)
      })
      Util.setObject3DOriginAtTarget(el.object3D, this.el.object3D)
      el.setAttribute('manipulator-lock', 'lockedPositionAxes: x, y, z')
      el.addState('snappedtoparent')
    }
  }
})

function registerCombinedFlagComponent(name, flags, {icon, color, onColor, selector})
{
  AFRAME.registerComponent(name, {
    dependencies: ['decorator-flag'].concat(flags),
    events: {
      cloneloaded: cloneloaded,
    },
    init() {
      this.el.setAttribute('decorator-flag', {color, icon})
      if (selector) this.el.setAttribute('decorator-flag', 'selector', selector)
    }
  })
}

function registerSimpleConstraintFlagComponent(
  name,
  {
    icon,
    color = "#b6c5f2",
    onColor,
    component,
    valueOn,
    valueOff = null,
    reparent = true,
    selector,
    dependencies = []
  }) {
  AFRAME.registerComponent(name, {
    dependencies: ['decorator-flag'].concat(dependencies),
    events: {
      startobjectconstraint: function(e) {
        let el = e.detail.el
        el.setAttribute(component, valueOn)

        if (onColor) { this.el.setAttribute('decorator-flag', 'color', onColor)}
      },
      endobjectconstraint: function(e) {
        let el = e.detail.el
        if (valueOff === null || valueOff === undefined)
        {
          el.removeAttribute(component)
        }
        else
        {
          if (!el) console.warn("No el for", name)
          el.setAttribute(component, valueOff)
        }

        if (onColor) { this.el.setAttribute('decorator-flag', 'color', color)}
      },
      cloneloaded: function(e) {
        e.stopPropagation()
        e.detail.el.setAttribute(name, this.el.getAttribute(name))
      }
    },
    init() {
      this.el.setAttribute('decorator-flag', {color, icon, reparent})
      if (selector) this.el.setAttribute('decorator-flag', 'selector', selector)
    }
  });
}

registerSimpleConstraintFlagComponent('lock-position-flag', {icon: '#asset-rotate-orbit', color: '#c14d30', component: 'manipulator-lock', valueOn: 'lockedPositionAxes: x, y, z', valueOff: null})
registerSimpleConstraintFlagComponent('look-at-flag', {icon: '#asset-eye', color: '#c14d30', component: 'manipulator-look-at-constraint', valueOn: '', valueOff: null})
registerSimpleConstraintFlagComponent('lock-y-flag', {icon: '#asset-swap-horizontal-variant', color: '#c14d30', component: 'manipulator-lock', valueOn: 'lockedPositionAxes: y; lockedRotationAxes: x, z', valueOff: null})
registerSimpleConstraintFlagComponent('lock-xz-flag', {icon: '#asset-swap-vertical-variant', color: '#c14d30', component: 'manipulator-lock', valueOn: 'lockedPositionAxes: x, z; lockedRotationAxes: x, z', valueOff: null})
registerSimpleConstraintFlagComponent('lock-rotation-flag', {icon: '#asset-arrow-all', color: '#c14d30', component: 'manipulator-lock', valueOn: 'lockedRotationAxes: x, y, z', valueOff: null})
registerSimpleConstraintFlagComponent('lock-all-flag', {icon: '#asset-lock-outline', color: '#c14d30', component: 'manipulator-lock', valueOn: 'lockedRotationAxes: x, y, z; lockedPositionAxes: x, y, z; lockedScaleAxes: x, y, z', valueOff: null})
registerSimpleConstraintFlagComponent('grid-flag', {icon: '#asset-dots-square', color: '#867555', component: 'manipulator-snap-grid', valueOn: 'enabled: true', valueOff: null})
registerSimpleConstraintFlagComponent('wrap-puppeteering-flag', {icon: '#asset-rotate-3d-variant', color: '#308a5f', onColor: '#bea', component: 'animation-3d-keyframed', valueOn: 'puppeteering: true; wrapAnimation: true', valueOff: 'puppeteering: false', dependencies: ['restart-animation-on-grab-flag']})
registerSimpleConstraintFlagComponent('no-wrap-puppeteering-flag', {icon: '#asset-record', color: '#308a5f', onColor: '#bea', component: 'animation-3d-keyframed', valueOn: 'puppeteering: true; wrapAnimation: false', valueOff: 'puppeteering: false', dependencies: ['restart-animation-on-grab-flag']})
registerSimpleConstraintFlagComponent('pause-animation-flag', {icon: '#asset-play-pause', color: '#308a5f', onColor: '#eaa', component: 'animation-3d-keyframed', valueOn: 'enabled: false', valueOff: 'enabled: true'})
registerSimpleConstraintFlagComponent('hidden-flag', {icon: "#asset-eye-off", onColor: '#bea', component: 'visible', valueOn: 'false', valueOff: 'true', reparent: false})
registerSimpleConstraintFlagComponent('adjustable-origin-flag', {icon: "#asset-drag-and-drop", color: '#313baa', onColor: '#bea', component: 'adjustable-origin', valueOn: '', valueOff: null, allowTools: false})
registerSimpleConstraintFlagComponent('edit-vertices-flag', {icon: "#asset-dots-square", color: '#313baa', component: 'vertex-handles', valueOn: '', valueOff: null, allowTools: false})
registerSimpleConstraintFlagComponent('quick-drawable-flag', {icon: "#asset-lead-pencil", color: '#b435ba', component: 'drawable', valueOn: 'includeTexturelessMeshes: true; useExisting: true', valueOff: null, allowTools: false, selector: 'a-entity[primitive-construct-placeholder]'})
registerSimpleConstraintFlagComponent('skeleton-only-flag', {icon: "#asset-skeletonator", component: 'skeleton-editor', valueOn: '', valueOff: null})
registerSimpleConstraintFlagComponent('kinematic-body-flag', {icon: "#asset-image-filter-hdr", component: 'physx-body', valueOn: 'type: kinematic', valueOff: 'type: kinematic'})

registerCombinedFlagComponent('skeleton-flag', ['skeleton-only-flag', 'wireframe-flag'], {icon: '#asset-skeletonator', color: '#308a5f', selector: ALL_MESHES})
// hide from spectator
// Trigger down
// Stay grabbed
// Undeletable
