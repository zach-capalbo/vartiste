import {Sfx} from './sfx.js'
import {Util} from './util.js'
import {Pool} from './pool.js'
import Color from "color"
import {Brush} from './brush.js'
import {BrushList} from './brush-list.js'
import {Undo} from './undo.js'

const DEFAULT_SELECTOR = "a-entity[six-dof-tool], a-entity[reference-glb], a-entity[primitive-construct-placeholder], a-entity[composition-view], a-entity[flaggable-manipulator], a-entity[flaggable-control]"
const TOOLS_ONLY_SELECTOR = "a-entity[six-dof-tool], a-entity[flaggable-manipulator]"
const SHAPES_AND_REFERENCED = "a-entity[reference-glb], a-entity[primitive-construct-placeholder]"

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
    obj.updateMatrix()
    this.handle.object3D.updateMatrix()

    let matrix = this.handle.object3D.matrix
    matrix.invert()

    if (obj.geometry)
    {
      let geometry = obj.geometry
      geometry.applyMatrix(matrix)
      if (geometry.boundsTree) geometry.computeBoundsTree()
      geometry.computeBoundingSphere()
      geometry.computeBoundingBox()
    }

    for (let c of obj.children)
    {
      if (c.el === this.handle) continue
      Util.applyMatrix(c.matrix.premultiply(matrix), c)
    }

    matrix.invert()
    Util.applyMatrix(obj.matrix.multiply(matrix), obj)
    Util.applyMatrix(matrix.identity(), this.handle.object3D)
    this.el.emit('originmoved', {})
  }
})



Util.registerComponentSystem('decorator-flag-system', {
})

AFRAME.registerComponent('decorator-flag', {
  dependencies: ['six-dof-tool', 'grab-activate'],
  schema: {
    selector: {type: 'string', default: DEFAULT_SELECTOR},
    reparent: {default: true},
    icon: {type: 'string'},
    color: {type: 'color', default: '#b6c5f2'},
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

      console.log("Intersecting tool", el, this.grabbedBy)
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
  makeClone() {
    let el = document.createElement('a-entity')
    if (this.el.attachedTo)
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
      Util.whenComponentInitialized(el, 'decorator-flag', () => {
        Util.whenLoaded(el.components['decorator-flag'].handle, () => {
          Util.delay(100).then(() => {
            console.log("Constraint Clone initialized")
            el.components['decorator-flag'].attachToTool()
          })
        })
      })
    })
  },
  attachTo(el, intersectionInfo) {
    this.attachedTo = el
    this.emitDetails.startobjectconstraint.el = el
    this.emitDetails.startobjectconstraint.intersectionInfo = intersectionInfo
    this.el.emit('startobjectconstraint', this.emitDetails.startobjectconstraint)
    Sfx.stickOn(this.el, {volume: 0.1})
  },
  detachFrom() {
    this.emitDetails.endobjectconstraint.el = this.attachedTo
    this.el.emit('endobjectconstraint', this.emitDetails.endobjectconstraint)

    this.attachedTo = undefined
    Sfx.stickOff(this.el, {volume: 0.05})
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

      el.setAttribute('manipulator-weight', `weight: ${this.calcWeight(el['tool-weight-tool-data'].weightCount)}; type: slow`)
      this.attachedTo = el
    },
    endobjectconstraint: function(e) {
      let el = this.attachedTo;

      el['tool-weight-tool-data'].weightCount--;

      if (el['tool-weight-tool-data'].weightCount === 0)
      {
        if (el['tool-weight-tool-data'].originalWeight)
        {
          this.attachedTo.setAttribute('manipulator-weight', el['tool-weight-tool-data'].originalWeight)
        }
        else
        {
          this.attachedTo.removeAttribute('manipulator-weight')
        }
        delete el['tool-weight-tool-data'];
      }
      else
      {
        el.setAttribute('manipulator-weight', `weight: ${this.calcWeight(el['tool-weight-tool-data'].weightCount)}; type: slow`)
      }
    },
    cloneloaded: function(e) {
      e.stopPropagation()
      e.detail.el.setAttribute('weight-constraint-flag', this.el.getAttribute('weight-constraint-flag'))
    }
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
    cloneloaded: function(e) {
      e.stopPropagation()
      e.detail.el.setAttribute('show-normals-flag', this.el.getAttribute('show-normals-flag'))
    }
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
    cloneloaded: function(e) {
      e.stopPropagation()
      e.detail.el.setAttribute('show-uv-flag', this.el.getAttribute('show-uv-flag'))
    }
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
    cloneloaded: function(e) {
      e.stopPropagation()
      e.detail.el.setAttribute('wireframe-flag', this.el.getAttribute('wireframe-flag'))
    }
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
    cloneloaded: function(e) {
      e.stopPropagation()
      e.detail.el.setAttribute('unclickable-flag', this.el.getAttribute('unclickable-flag'))
    }
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
    cloneloaded: function(e) {
      e.stopPropagation()
      e.detail.el.setAttribute('axis-handles-flag', this.el.getAttribute('axis-handles-flag'))
    }
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
    cloneloaded: function(e) {
      e.stopPropagation()
      e.detail.el.setAttribute('inspector-flag', this.el.getAttribute('inspector-flag'))
    }
  },
  init() {
    this.el.setAttribute('decorator-flag', 'icon: #asset-newspaper-variant-outline')
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

function registerCombinedFlagComponent(name, flags, {icon, color, onColor, selector})
{
  AFRAME.registerComponent(name, {
    dependencies: ['decorator-flag'].concat(flags),
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
registerSimpleConstraintFlagComponent('edit-vertices-flag', {icon: "#asset-dots-square", color: '#313baa', omponent: 'vertex-handles', valueOn: '', valueOff: null, allowTools: false})
registerSimpleConstraintFlagComponent('quick-drawable-flag', {icon: "#asset-lead-pencil", color: '#b435ba', component: 'drawable', valueOn: 'includeTexturelessMeshes: true; useExisting: true', valueOff: null, allowTools: false, selector: 'a-entity[primitive-construct-placeholder]'})
registerSimpleConstraintFlagComponent('skeleton-only-flag', {icon: "#asset-skeletonator", component: 'skeleton-editor', valueOn: '', valueOff: null, allowTools: false})

registerCombinedFlagComponent('skeleton-flag', ['skeleton-only-flag', 'wireframe-flag'], {icon: '#asset-skeletonator', color: '#308a5f'})
// hide from spectator
// Trigger down
// Stay grabbed
// Undeletable
// Remember position
// Axes Scale
