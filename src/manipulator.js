import {Axes} from './joystick-directions.js'
import {Undo} from './undo.js'
import {Util} from './util.js'
import {Pool} from './pool.js'

export const IMMEDIATE_PRIORITY = 0
export const GRID_PRIORITY = 100
export const SNAP_PRIORITY = 200
export const DEFAULT_GLOBAL_PRIORITY = 400
export const DEFAULT_PRIORITY = 500
export const CONSTRAINT_PRIORITY = 600
export const POST_MANIPULATION_PRIORITY = 1000

// Utility for managing all manipulators.
// Add a callback function to the `sceneEl.systems.manipulator.postManipulationCallbacks`
// to be notified of any changes to manipulated objects anywhere.
AFRAME.registerSystem('manipulator', {
  init() {
    this.postManipulationCallbacks = new Map()
    this.knownPriorities = [DEFAULT_PRIORITY]
    this.tick = AFRAME.utils.throttleTick(this.tick, 5000, this)
  },
  postManipulation(el, localOffset) {
    if (!this.postManipulationCallbacks.length) return

    for (let c of this.postManipulationCallbacks)
    {
      c(el, localOffset)
    }
  },
  // Installs a constraint for the manipulating the given entity.  Multiple
  // constraints may be installed, however you should only install each
  // constraint once per entity.
  //
  // Returns the constraintFn, to make it easier to use with anonymous functions.
  installConstraint(el, constraintFn, priority = DEFAULT_PRIORITY) {
    if (!el.manipulatorConstraints) el.manipulatorConstraints = new Map()
    let priorityList = el.manipulatorConstraints.get(priority)
    if (!priorityList) {
      priorityList = []
      el.manipulatorConstraints.set(priority, priorityList)
    }
    priorityList.push(constraintFn)
    if (this.knownPriorities.indexOf(priority) < 0)
    {
      this.knownPriorities.push(priority)
      this.knownPriorities.sort((a, b) => a - b)
    }
    return constraintFn
  },
  // Removes the constraint for manipulating the given entity
  removeConstraint(el, constraintFn) {
    if (!el.manipulatorConstraints) return;
    for (let priorityList of el.manipulatorConstraints.values())
    {
      let idx = priorityList.indexOf(constraintFn)
      if (idx >= 0)
      {
        priorityList.splice(idx, 1)
      }
    }
  },
  installGlobalConstraint(constraintFn, priority = DEFAULT_GLOBAL_PRIORITY) {
    let priorityList = this.postManipulationCallbacks.get(priority)
    if (!priorityList) {
      priorityList = []
      this.postManipulationCallbacks.set(priority, priorityList)
    }
    priorityList.push(constraintFn)
    if (this.knownPriorities.indexOf(priority) < 0)
    {
      this.knownPriorities.push(priority)
      this.knownPriorities.sort((a, b) => a - b)
    }
    return constraintFn
  },
  removeGlobalConstraint(constraintFn) {
    for (let priorityList of this.postManipulationCallbacks.values())
    {
      let idx = priorityList.indexOf(constraintFn)
      if (idx >= 0)
      {
        priorityList.splice(idx, 1)
      }
    }
  },
  runConstraints(target, localOffset, t, dt) {
    if (!target) return;
    if (!target.object3D) return;
    if (target.manipulatorConstraint) {
      console.trace("manipulatorConstraint is deprecated. Please use sceneEl.systems.manipulator.installConstraint instead")
      target.manipulatorConstraint(t, dt)
    }

    for (let priority of this.knownPriorities)
    {
      let priorityList;
      if (target.manipulatorConstraints) {
        priorityList = target.manipulatorConstraints.get(priority)
        if (priorityList) {
          for (let c of priorityList)
          {
            c(t,dt, localOffset)
          }
        }
      }
      priorityList = this.postManipulationCallbacks.get(priority)
      if (priorityList) {
        for (let c of priorityList)
        {
          c(target, t,dt, localOffset)
        }
      }
    }
  },
  tick(t, dt) {
    this.el.emit('refreshobjects')
  }
})

// Allows `laser-controls` to grab, rotate, and scale elements in 3D.
//
// #### Grabbing
//
// Grabbing begins when the element with the `manipulator` receives the
// `gripdown` event, or when `onGripClose` is called directly. When this occurs,
// it will use the `raycaster` component to find the closest intersected
// element. It will recursively search this element for redirections (see
// below), until it finds the final grab target. *Note,* by default, VARTISTE
// uses `.clickable, .canvas` as the raycaster selector.
//
// Once the final target has been selected, it receives the 'grabbed' state, and
// the manipulator's element receives the 'grabbing' state. Every tick while
// grabbing is occuring, the target's position and rotation will be updated to
// match the manipulator's movements as though the target had been a child
// object of the manipulator. (*Note,* the target's parent never changes, and it
// does not actually become a child of the manipulator)
//
// #### Redirection
//
// An element can "redirect" or pass on being grabbed to a different element.
// When this happens, the target of the redirection becomes the target of the
// grab, even if it is not intersected by the raycaster. The target of the
// redirection can in turn have its own redirection, and so forth, until a
// target is found without a redirection. (*Note*, there is currently no
// circular redirection detection. So keep an eye out and don't do that.)
//
// A redirect can be set explicitly in two ways. The first is to set the
// javascript property `redirect-grab` directly on the grabbable element itself.
// (E.g., from a component, setting `this.el['redirect-grab'] = someOtherEl`).
// The second way is to use the [`redirect-grab`](#redirect-grab) component,
// which has a `selector` property for setting the redirection.
//
// Redirection can also be set to propogate, via the
// [`propogate-grab`](#propogate-grab) component. When this is set, the redirect
// target will be the closest parent element that is grabbable (e.g., has the
// `clickable` class). This is especially useful for building subcomponents of a
// grabbable UI shelf, for instance. Without `propogate-grab`, the child
// components could accidentally be grabbed off of the parent shelf.
//
// #### Rotation, Scaling, and Zooming
//
// If the `manipulator` element has the `rotating` state, then the target
// elements' rotation is updated each tick. If not, the target maintains its
// rotation, even as its position changes.
//
// Setting the `manipulator` component's `scaleAmmount` javascript property
// (e.g., `el.components.manipulator.scaleAmmount = 1.2`) will cause the object
// to grow bigger or smaller each tick (depending on the sign of
// `scaleAmmount`). Setting the `zoomAmmount` will cause the object to move
// closer or farther each tick (depending on the sign of `zoomAmmount`).
AFRAME.registerComponent('manipulator', {
  dependencies: ['scalable-raycaster'],
  schema: {
    // Note: **Don't Use**
    selector: {type: 'string'},
    // Note: **Don't Use**
    useRay: {type:'boolean', default: true},

    useIntersections: {default: false},

    // Logs debug messages to the console
    printUpdates: {type: 'boolean', default: false},

    // Grab button toggles rather than grip / release
    grabToggleTimeout: {default: 200},

    rotateByDefault: {default: false},
  },
  pool(name, type) {
    if (this._pool[name]) return this._pool[name]
    this._pool[name] = new type()
    return this._pool[name]
  },
  init() {
    this._pool = {}
    this.rightHand = this.el

    this.grabber = document.createElement('a-entity')
    this.grabber.setAttribute('gltf-model', "#asset-hand")
    this.grabber.setAttribute('visible', "false")
    this.grabber.setAttribute('material', 'shader: matcap')
    this.grabber.setAttribute('apply-material-to-mesh', "")
    this.el.append(this.grabber)

    this.onGripClose = this.onGripClose.bind(this)
    this.onGripOpen = this.onGripOpen.bind(this)

    this.rightHand.addEventListener('gripdown', this.onGripClose)
    this.rightHand.addEventListener('gripup', this.onGripOpen)

    this.zoomAmmount = 0
    this.scaleAmmount = 0
    this.el.addEventListener('axismove', e => {
      this.zoomAmmount = e.detail.axis[Axes.up_down(this.el)]
      this.scaleAmmount = - e.detail.axis[Axes.left_right(this.el)]
    })

    this.startPoint = new THREE.Object3D()
    this.endPoint = new THREE.Object3D()

    this.startPoint.add(this.endPoint)
    this.el.sceneEl.object3D.add(this.startPoint)

    this.invM = new THREE.Matrix4()

    this.raycaster = this.el.components.raycaster

    if (this.data.printUpdates)
    {
      var geometry = new THREE.BoxGeometry( 0.1, 0.1, 0.1 );
      this.startPoint.add(new THREE.Mesh( geometry, new THREE.MeshBasicMaterial( {color: 0x00ff00} ) ))

    }

    this.grabLine = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0,0,0),
    new THREE.Vector3(0,0,4)]);
    this.grabLineObject = new THREE.Line(this.grabLine, new THREE.LineBasicMaterial( { color: 0xffff00, linewidth: 50 } ))
    this.startPoint.add(this.grabLineObject);

    this.grabLineObject.visible = false
    this.endPoint.visible = false
    this.offset = new THREE.Vector3(0, 0, 0);

    let _refreshObjects = this.raycaster.refreshObjects
    this.raycaster.refreshObjects = function(...args) {
      _refreshObjects.call(this,...args)
      let o
      let j = 0
      // this.objects = this.objects.filter(o => {
      for (let i = 0; i < this.objects.length; ++i) {
        let o = this.objects[i]
        if (o.el.className.includes("raycast-invisible")) continue
        //if (o.el.classList.contains("raycast-invisible")) continue
        //if (o.el.hasAttribute('visible') && !o.el.getAttribute('visible')) continue
        if (!o.visible) continue

        let parentVisible = true
        o.traverseAncestors(a => parentVisible = parentVisible && a.visible)
        if (!parentVisible) continue

        this.objects[j++] = o
      }
      this.objects.length = j
    }

    this.refreshNeeded = true
    this.el.sceneEl.addEventListener('refreshobjects', e => {
      this.refreshNeeded = true
    })

    // Default grab-options
    this.el.setAttribute('grab-options', "")

    if (this.data.rotateByDefault) this.el.addState('rotating')
  },
  startGrab() {
    if (this.target.grabbingManipulator) {
      this.target = undefined
      // stopGrab()
      return
    }

    this.target.grabbingManipulator = this
    this.target.addState("grabbed")

    this.el.components['raycaster'].pause()

    this.grabOptions = this.target.hasAttribute('grab-options') ? this.target.getAttribute('grab-options') : this.el.getAttribute('grab-options')

    let startMatrix = new THREE.Matrix4
    startMatrix.copy(this.target.object3D.matrix)
    let obj3d = this.target.object3D

    if (this.grabOptions.undoable)
    {
      Undo.push(() => {
        obj3d.matrix.copy(startMatrix)
        obj3d.matrix.decompose(obj3d.position, obj3d.quaternion, obj3d.scale)
      })
    }

    this.el.addState('grabbing')

    let settings = this.el.sceneEl.systems['settings-system']

    let targetQuart = this.pool("targetQuart", THREE.Quaternion)
    this.rightHand.object3D.getWorldQuaternion(targetQuart)
    this.startPoint.setRotationFromQuaternion(targetQuart)
    this.rightHand.object3D.getWorldPosition(this.startPoint.position)

    this.startPoint.updateMatrixWorld()
    this.invM.copy(this.startPoint.matrixWorld).invert()

    this.target.object3D.updateMatrixWorld()

    this.target.object3D.getWorldPosition(this.endPoint.position)
    this.startPoint.worldToLocal(this.endPoint.position)
    this.endPoint.scale.copy(this.target.object3D.scale)

    this.startPoint.updateMatrixWorld()

    let pmw = this.pool('pmw', THREE.Matrix4)
    pmw.copy(this.startPoint.matrixWorld).invert()

    this.target.object3D.getWorldQuaternion(targetQuart)

    let id = this.pool('identity', THREE.Matrix4)
    id.identity()
    id.extractRotation(pmw)
    let invQuart = this.pool('invQuart', THREE.Quaternion)
    invQuart.setFromRotationMatrix(id)
    invQuart.multiply(targetQuart)

    this.endPoint.setRotationFromQuaternion(invQuart)

    if (this.offset)
    {
      let startOffset = this.pool('startOffset', THREE.Vector3)
      startOffset.copy(this.offset)

      this.endPoint.position.copy(this.offset)
      this.startPoint.worldToLocal(this.endPoint.position)
      this.endPoint.updateMatrixWorld()

      // Offset still in world space

      let twp = this.pool('twp', THREE.Vector3)
      this.target.object3D.getWorldPosition(twp)
      this.offset.sub(twp)

      // offset now difference between intersection and target origin in world space

      let quart = this.pool('quart', THREE.Quaternion)
      this.target.object3D.getWorldQuaternion(quart)
      this.offset.applyQuaternion(quart.conjugate());

      let ws = this.pool('ws', THREE.Vector3)
      this.target.object3D.parent.getWorldScale(ws)
      this.offset.divide(ws)
      // console.log("Offset", this.offset)
      // console.log("WS Offset", startOffset)
      // console.log("WS Target", twp)
      // console.log("Parent WS", ws)
    }

    this.grabLine.attributes.position.setXYZ(1, this.endPoint.position.x, this.endPoint.position.y, this.endPoint.position.z)

    this.grabLine.attributes.position.needsUpdate = true;
    this.grabLineObject.visible = true
    this.endPoint.visible = true;

    this.grabber.object3D.visible = this.grabOptions.showHand
    // this.grabber.object3D.parent.remove(this.grabber.object3D)
    this.endPoint.attach(this.grabber.object3D)
    this.grabber.object3D.position.set(0,0,0)
    this.grabber.object3D.rotation.set(0,0,0)
    this.grabber.object3D.updateMatrixWorld()

    let worldScale = this.pool('worldScale', THREE.Vector3)
    this.grabber.object3D.parent.getWorldScale(worldScale)
    this.grabber.object3D.scale.set(0.04 / worldScale.x, 0.04 / worldScale.y, 0.04 / worldScale.z)
    //this.grabber.object3D.scale.set(0.4, 0.4, 0.4)
  },
  stopGrab() {
    if (this.data.printUpdates && this.target)
    {
      console.log(this.target,
                  "\n\nposition=\"" + AFRAME.utils.coordinates.stringify(this.target.object3D.position) +"\"",
                  "\n\nrotation=\"" + AFRAME.utils.coordinates.stringify({
                    x: THREE.Math.radToDeg(this.target.object3D.rotation.x),
                    y: THREE.Math.radToDeg(this.target.object3D.rotation.y),
                    z: THREE.Math.radToDeg(this.target.object3D.rotation.z),
                  }) + "\"",
                `\n\nscale="${AFRAME.utils.coordinates.stringify(this.target.object3D.scale)}"`)
    }

    if (this.target)
    {
      this.target.grabbingManipulator = undefined
      this.target.removeState("grabbed")
    }

    this.target = undefined
    this.grabLineObject.visible = false
    this.endPoint.visible = false
    this.el.removeState('grabbing')
    this.el.components['raycaster'].play()
  },
  onGripClose(e){
    if (e) {
      e.preventDefault()
      e.stopPropagation()
    }

    if (this.el.is('grabbing') && this.grabToggleLocked) {
      this.readyToRelease = true
    }

    if (this.el.is('grabbing')) return
    this.readyToRelease = false

    this.gripClosedTime = this.el.sceneEl.time

    if (this.data.useIntersections)
    {
      let thisMesh = this.el.getObject3D('mesh')
      for (let obj of this.raycaster.objects)
      {
        if (Util.objectsIntersect(thisMesh, obj))
        {
          let targetEl = obj.el

          if (this.data.printUpdates)
          {
            console.log("GRABBING from intersection")
          }

          this.target = targetEl

          for (let redirection = targetEl['redirect-grab']; redirection; redirection = this.target['redirect-grab'])
          {
            if (this.data.printUpdates)
            {
              console.log("Redirecting grab to", typeof(redirection), redirection)
            }
            this.target = redirection
          }

          this.offset.set(0, 0, 0)

          this.startGrab()

          return;
        }
      }
    }

    if (this.data.useRay)
    {
      if (!this.raycaster.intersectedEls.length > 0)
      {
        return
      }

      let targetEl = this.raycaster.intersectedEls[0]
      let intersection = this.raycaster.getIntersection(targetEl)

      if (this.data.printUpdates)
      {
        console.log("GRABBING", targetEl, intersection)
      }

      if (!targetEl.object3D.parent) {
        console.warn("Object has no parent", targetEl);
        return;
      }

      this.target = targetEl

      for (let redirection = targetEl['redirect-grab']; redirection; redirection = this.target['redirect-grab'])
      {
        if (this.data.printUpdates)
        {
          console.log("Redirecting grab to", typeof(redirection), redirection)
        }
        this.target = redirection
      }

      this.offset.copy(intersection.point)

      this.startGrab()
    }
    else
    {
      this.target = document.querySelector(this.data.selector)
      this.offset = undefined
      this.startGrab()
    }
  },
  onGripOpen() {
    if (this.el.sceneEl.time - this.gripClosedTime < this.data.grabToggleTimeout)
    {
      this.grabToggleLocked = true;
      return;
    }

    this.stopGrab()

    if (this.data.printUpdates)
    {
      console.log("GripOpen")
    }
  },
  tick(t, dt) {
    if (this.refreshNeeded)
    {
      this.raycaster.refreshObjects()
      this.refreshNeeded = false
    }

    if (this.target) {
      if (!this.target.object3D.parent)
      {
        console.warn("Target parent disappeared!")
        this.stopGrab()
        return;
      }
      if (Math.abs(this.zoomAmmount) > 0.08)
      {
        if (this.el.is("orbiting"))
        {
          // let quart = this.pool("quart", THREE.Quaternion)
          let rotAxis = this.pool("axis", THREE.Vector3).set(1, 0, 0)

          // quart.setFromAxisAngle(rotAxis, this.zoomAmmount * dt / 300)

          // this.endPoint.quaternion.multiply(quart)
          // let invm = this.pool("invm", THREE.Matrix4)
          // invm.copy(this.endPoint.matrix).invert()
          // rotAxis.applyMatrix4(invm)
          // rotAxis.normalize()

          // this.startPoint.localToWorld(rotAxis)
          // this.endPoint.worldToLocal(rotAxis)

          // this.el.object3D.localToWorld(rotAxis)

          rotAxis.normalize()

          if (this.data.printUpdates)
          {
            console.log(rotAxis)
          }

          this.endPoint.rotateOnAxis(rotAxis, this.zoomAmmount * dt / 300)
        }
        else
        {
          this.endPoint.position.multiplyScalar(1.0 - (0.2 * this.zoomAmmount * dt / 100))
        }
      }

      if (Math.abs(this.scaleAmmount) > 0.08)
      {
        if (this.el.is("orbiting"))
        {
          let rotAxis = this.pool("axis", THREE.Vector3).set(0, 1, 0)
          // this.el.object3D.localToWorld(rotAxis)
          rotAxis.normalize()
          this.endPoint.rotateOnAxis(rotAxis, this.scaleAmmount * dt / 300)
        }
        else
        {
          if (this.grabOptions.scalable)
          {
            let scaleFactor = 1.0 - (0.2 * this.scaleAmmount * dt / 100)
            // this.target.object3D.scale.multiplyScalar(scaleFactor)
            this.endPoint.scale.multiplyScalar(scaleFactor)
            this.grabber.object3D.scale.multiplyScalar(1.0 / scaleFactor)
            this.offset.multiplyScalar(scaleFactor)
          }
        }
      }

      this.rightHand.object3D.getWorldPosition(this.startPoint.position)

      var quart = this.pool('quart', THREE.Quaternion)
      this.rightHand.object3D.getWorldQuaternion(quart)
      this.startPoint.setRotationFromQuaternion(quart)
      this.startPoint.updateMatrixWorld()
      this.endPoint.updateMatrixWorld()


      this.target.object3D.position.set(0,0,0)
      let pmw = this.pool('pmw', THREE.Matrix4)
      pmw.copy(this.target.object3D.parent.matrixWorld).invert()

      this.endPoint.getWorldQuaternion(quart)

      if (!this.grabOptions.lockRotation && this.el.is('rotating') || this.el.is('orbiting'))
      {
        let id = this.pool('identity', THREE.Matrix4)
        id.identity()
        id.extractRotation(pmw)
        let invQuart = this.pool('invQuart', THREE.Quaternion)
        invQuart.setFromRotationMatrix(id)
        invQuart.multiply(quart)

        this.target.object3D.setRotationFromQuaternion(invQuart)
      }

      this.endPoint.getWorldPosition(this.target.object3D.position)
      if (this.target.object3D.parent) this.target.object3D.parent.worldToLocal(this.target.object3D.position)

      let localOffset = this.pool('localOffset', THREE.Vector3)
      localOffset.copy(this.offset)

      let pws = this.pool('pws', THREE.Vector3)

      localOffset.applyQuaternion(this.target.object3D.quaternion)

      this.target.object3D.position.sub(localOffset)
      this.target.object3D.scale.copy(this.endPoint.scale)

      if (this.resetZoom) {
        this.zoomAmmount = 0
        this.scaleAmmount = 0
        this.resetZoom = false
      }

      this.system.runConstraints(this.target, localOffset, t, dt)
    }
  }
})

// Allows a mouse to function as a [`manipulator`](#manipulator). Shift click
// grabs and moves objects, and the scroll wheel moves them closer or farther,
// and scroll wheel plus the alt key scales the object bigger and smaller.
AFRAME.registerComponent('mouse-manipulator', {
  dependencies: ["manipulator"],
  init() {
    this.el.setAttribute('manipulator', {useRay: true})
    document.addEventListener('mousedown', e => {
      if (!(this.el.is('grabmode') || e.shiftKey)) return
      if (this.el.is('grabbing')) return

      this.el.components.manipulator.onGripClose()
    })

    document.addEventListener('mouseup', e=> {
      // if (e.button == 0) return
      this.el.components.manipulator.onGripOpen()
    })

    document.addEventListener('wheel', e => {
      if (!(this.el.is('grabmode') || e.shiftKey)) return

      if (e.altKey)
      {
        this.el.components.manipulator.scaleAmmount = e.deltaY * ((e.deltaY > 50 || e.deltaY < -50) ? 0.01 : 1)
      }
      else
      {
        this.el.components.manipulator.zoomAmmount = e.deltaY * ((e.deltaY > 50 || e.deltaY < -50) ? 0.01 : 1)
      }

      this.el.components.manipulator.resetZoom = true
    })

  },
})

AFRAME.registerComponent('grabbable', {
  init() {
    this.el.classList.add('clickable')
  },
  remove() {
    this.el.classList.remove('clickable')
  }
})

AFRAME.registerComponent('grab-root', {
  init() {
    this.el.classList.add('grab-root')
  },
  remove() {
    this.el.classList.remove('grab-root')
  }
})

// Redirects a grab from the [`manipulator`](#manipulator) to the closest
// grabbable parent element.
AFRAME.registerComponent('propogate-grab', {
  init() {
    for (let parent = this.el.parentEl; parent; parent = parent.parentEl)
    {
      if (parent['redirect-grab'] || parent.classList.contains('clickable') || parent.classList.contains('grab-root'))
      {
        this.el['redirect-grab'] = parent
        break;
      }
    }
  },
  remove() {
    delete this.el['redirect-grab'];
  }
})

// Redirects a grab from the [`manipulator`](#manipulator) to the
// selector target
AFRAME.registerComponent('redirect-grab', {
  // Element that will receive any grab and movement activity instead
  schema: {type: 'selector'},
  update() {
    this.el['redirect-grab'] = this.data
  }
})

// Options to change the grab behavior when an element is grabbed by a
// manipulator.
AFRAME.registerComponent('grab-options', {
  schema: {
    // If true, a blue hand (the `#asset-hand` asset), will be shown at the
    // location of the grab.
    showHand: {type: 'boolean', default: true},

    // If true, this element can be scaled by the manipulator
    scalable: {type: 'boolean', default: true},

    // If true, grabbing this element will add an undo action to restore its
    // initial location to the undo stack
    undoable: {type: 'boolean', default: false},

    lockRotation: {default: false},
  }
})

// Locks the objects up direction, even when it is grabbed and rotated by the [Manipulator](#manipulator)
AFRAME.registerComponent('lock-up', {
  init() {
    Pool.init(this)
    this.constrainObject = this.constrainObject.bind(this)
    this.startQuartenion = new THREE.Quaternion
    this.startUp = new THREE.Vector3
  },
  events: {
    stateadded: function(e) {
      if (e.detail === 'grabbed')
      {
        this.startQuartenion.copy(this.el.object3D.quaternion)
      }
    }
  },
  play() {
    this.el.sceneEl.systems.manipulator.installConstraint(this.el, this.constrainObject)
  },
  pause() {
    this.el.sceneEl.systems.manipulator.removeConstraint(this.el, this.constrainObject)
  },
  constrainObject(t, dt, localOffset) {
    let forward = this.pool('forward', THREE.Vector3)
    let up = this.pool('up', THREE.Vector3)
    let obj = this.el.object3D
    obj.updateMatrix()


    up.set(0, 1, 0)
    up.applyQuaternion(obj.quaternion)

    let quart = this.pool('quart', THREE.Quaternion)
    quart.setFromUnitVectors(up, this.el.sceneEl.object3D.up)

    obj.quaternion.premultiply(quart)

    let manipulator = this.el.grabbingManipulator

    manipulator.endPoint.getWorldPosition(obj.position)
    if (obj.parent) obj.parent.worldToLocal(obj.position)

    localOffset.copy(manipulator.offset)

    let pws = this.pool('pws', THREE.Vector3)

    localOffset.applyQuaternion(obj.quaternion)

    obj.position.sub(localOffset)
  }
})

// The first time an element with this component is grabbed, it will emit the
// `activate` event.
AFRAME.registerComponent('grab-activate', {
  events: {
    stateremoved: function(e) {
      if (e.detail === 'grab-activated' && e.target === this.el)
      {
        this.init()
      }
    }
  },
  init() {
    let activate = (e) => {
      if ((e.detail === 'grabbed' || e.detail === 'wielded') && e.target === this.el) {
        if (this.el.is('grab-activated')) return;

        this.el.emit('activate')
        this.el.removeEventListener('stateadded', activate)
        this.el.addState('grab-activated')
      }
    };
    this.el.addEventListener('stateadded', activate)
  }
})

AFRAME.registerComponent('manipulator-info-text', {
  dependencies: ['text'],
  init() {
    this.el.sceneEl.systems.manipulator.installGlobalConstraint((el) => {
      this.el.setAttribute('text', 'value', `position="${AFRAME.utils.coordinates.stringify(el.object3D.position)}"\nrotation="${AFRAME.utils.coordinates.stringify({
        x: THREE.Math.radToDeg(el.object3D.rotation.x),
        y: THREE.Math.radToDeg(el.object3D.rotation.y),
        z: THREE.Math.radToDeg(el.object3D.rotation.z),
      })}"\nscale="${AFRAME.utils.coordinates.stringify(el.object3D.scale)}"`)
    }, POST_MANIPULATION_PRIORITY)
  }
})

AFRAME.registerComponent('copy-manipulator-info-text', {
  events: {
    click: function() {
      let txt = document.querySelector('*[manipulator-info-text]').getAttribute('text').value
      txt = txt.replace(/\n/mg, " ")
      console.log("Manipulator info", txt)
      this.el.sceneEl.systems['settings-system'].copyToClipboard(txt, "Manipulator Info")
    }
  }
})

// Constrains the objects movement when moved by the [manipulator](#manipulator)
// by locking the object’s point of origin within a sphere.
// The object bleeds beyond the edges of the sphere, but stops when its point of
// origin reaches the inner or outer radius. innerRadius can be omitted to allow for full
// movement within outerRadius.
AFRAME.registerComponent('constrain-to-sphere', {
  schema: {
    // The inner limit of movement, in world units
    innerRadius: {default: 0.0},
    // The outer limit of movement, in world units
    outerRadius: {default: 1.0},
    // Sets the constraint when the scene loads
    constrainOnLoad: {default: true}
  },
  init() {
    this.constrainObject = this.constrainObject.bind(this)
    Util.whenLoaded(this.el, () => {
      if (this.data.constrainOnLoad)
      {
        this.constrainObject()
      }
    })
  },
  play() {
    this.el.sceneEl.systems.manipulator.installConstraint(this.el, this.constrainObject, CONSTRAINT_PRIORITY)
  },
  pause() {
    this.el.sceneEl.systems.manipulator.removeConstraint(this.el, this.constrainObject)
  },
  constrainObject() {
    this.el.object3D.position.clampLength(this.data.innerRadius, this.data.outerRadius)
  }
})

AFRAME.registerComponent('manipulator-look-at-constraint', {
  init() {
    this.constrainObject = this.constrainObject.bind(this)
    this.el.sceneEl.systems.manipulator.installConstraint(this.el, this.constrainObject)
    this.worldPos = new THREE.Vector3
  },
  play() {
    this.originalPosition = new THREE.Vector3().copy(this.el.object3D.position)
  },
  remove() {
    this.el.sceneEl.systems.manipulator.removeConstraint(this.el, this.constrainObject)
  },
  constrainObject(t, dt, localOffset) {
    this.el.object3D.updateMatrix()
    // console.log("Constraining look at", this.el.object3D.position, localOffset)

    this.el.object3D.getWorldPosition(this.worldPos)
    this.worldPos.add(localOffset)

    // let dist = this.originalPosition.distanceTo(this.el.object3D.position)
    this.el.object3D.position.copy(this.originalPosition)

    // if (dist < 0.01) return;
    this.el.object3D.lookAt(this.worldPos)
  }
})

// Creates a grabable lever that can be moved up and down to change a value
AFRAME.registerComponent('lever', {
  schema: {

    // Direction for lever to move. Should be `'x'`, `'y'`, or `'z'`
    axis: {type: 'string', oneOf: ['x', 'y', 'z'], default: 'z'},

    // Length of the lever handle
    handleLength: {default: 0.35},

    // Radius of the grip sphere
    gripRadius: {default: 0.07},

    // **[min, max]** Range of motion in degrees for the handle. Min and max should be between 0 and 180
    angleRange: {type: 'vec2', default: new THREE.Vector2(30, 150)},

    // Tick throttle
    throttle: {default: 10},

    // Initial value, should be between min and max of `valueRange`
    initialValue: {default: 0.0},

    // **[top, bottom]** Output range of the values. The lever angle will be mapped to this range
    // when moved
    valueRange: {type: 'vec2', default: new THREE.Vector2(0, 1)},

    // [Optional] If specified, the lever will update the component property of `target` (as specified by the lever's `component` and `property` properties)
    target: {type: 'selector'},

    // [Optional] The component of `target` to update
    component: {type: 'string'},

    // [Optional] The property of `target` to update
    property: {type: 'string'},
  },
  init() {
    Pool.init(this)
    let angler = document.createElement('a-entity')
    this.angler = angler
    this.el.append(angler)
    this.el.classList.add('grab-root')
    this.el.setAttribute('grab-options', 'showHand: false')
    let bodyPositioner = document.createElement('a-entity')
    let body = document.createElement('a-cylinder')
    body.setAttribute('rotation', '90 90 90')
    body.setAttribute('height', this.data.handleLength)
    body.setAttribute('position', `0 0 ${this.data.handleLength / 2}`)
    body.setAttribute('radius', 0.035)
    body.setAttribute('segments-radial', 6)
    body.setAttribute('segments-height', 1)
    body.setAttribute('material', 'side: double; src: #asset-shelf; metalness: 0.4; roughness: 0.7')
    body.classList.add('clickable')
    body.setAttribute('propogate-grab', "")
    if (document.getElementById('lever-handle')) body.setAttribute('mixin', 'lever-handle')
    this.body = body
    this.bodyPositioner = bodyPositioner
    bodyPositioner.append(body)
    angler.append(bodyPositioner)

    let gripPositioner = document.createElement('a-entity')
    let grip = document.createElement('a-sphere')
    grip.setAttribute('position', `0 ${this.data.handleLength} 0`)
    grip.setAttribute('radius', this.data.gripRadius)
    grip.setAttribute('segments-radial', Util.isLowPower() ? 4 : 6)
    grip.setAttribute('segments-height', 4)
    grip.setAttribute('material', 'side: double; metalness: 0.7; roughness: 0.3')
    grip.setAttribute('grab-options', 'showHand: false; scalable: false')
    if (document.getElementById('lever-grip')) grip.setAttribute('mixin', 'lever-grip')
    //grip.setAttribute('constrain-to-sphere', `innerRadius: ${this.data.handleLength}; outerRadius: ${this.data.handleLength}`)
    grip.classList.add('clickable')
    // gripPositioner.append(grip)
    this.gripPositioner = gripPositioner
    this.grip = grip
    angler.append(grip)

    this.el.sceneEl.systems.manipulator.installConstraint(grip, this.constrainObject.bind(this), CONSTRAINT_PRIORITY)
    Util.whenLoaded([this.el, grip, body], () => this.setValue(this.data.initialValue))

    this.el['redirect-grab'] = this.grip

    this.spherical = new THREE.Spherical()

    this.origin = new THREE.Vector3(0, 0, 0)
    this.forward = new THREE.Vector3(1, 0, 0)

    this.eventDetail = {angle: 0, percent: 0, value: this.data.initialValue}
  },
  update(oldData) {
    this.tick = AFRAME.utils.throttleTick(this._tick, this.data.throttle, this)

    switch (this.data.axis)
    {
      case 'x':
        this.angler.setAttribute('rotation', '0 0 0')
      break
      case 'y':
        this.angler.setAttribute('rotation', '90 -90 0')
      break
      case 'z':
      this.angler.setAttribute('rotation', '0 -90 0')
      break
    }

    if (this.data.gripRadius !== oldData.gripRadius)
    {
      this.grip.setAttribute('radius', this.data.gripRadius)
    }

    if (this.data.target !== oldData.target)
    {
      if (oldData.target)
      {
        oldData.target.removeEventListener('componentchanged', this.componentchangedlistener)
      }

      if (this.data.target)
      {
        this.componentchangedlistener = (e) => {
          if (e.detail.name === this.data.component)
          {
            this.setValue(this.data.target.getAttribute(this.data.component)[this.data.property])
            this.constrainObject()
          }
        }
        this.data.target.addEventListener('componentchanged', this.componentchangedlistener)

        Util.whenLoaded([this.grip, this.el, this.data.target], () => {
          this.componentchangedlistener({detail: {name: this.data.component}})
        })
      }
    }
  },
  tick() {},

  // Set the lever to the position corresponding to `value`
  setValue(value) {
    let {grip} = this
    grip.object3D.position.z = 0
    grip.object3D.position.x = Math.max(grip.object3D.position.x, 0.001)
    this.spherical.setFromCartesianCoords(grip.object3D.position.x, grip.object3D.position.y, grip.object3D.position.z)
    this.spherical.theta = Math.PI/ 2
    this.spherical.radius = this.data.handleLength
    this.spherical.phi = THREE.Math.mapLinear(value, this.data.valueRange.x, this.data.valueRange.y, this.data.angleRange.x * Math.PI / 180, this.data.angleRange.y * Math.PI / 180)
    grip.object3D.position.setFromSpherical(this.spherical)

    this.bodyPositioner.object3D.matrix.lookAt(this.grip.object3D.position, this.origin, this.forward)
    Util.applyMatrix(this.bodyPositioner.object3D.matrix, this.bodyPositioner.object3D)
  },
  constrainObject() {
    let {grip} = this
    grip.object3D.position.z = 0
    grip.object3D.position.x = Math.max(grip.object3D.position.x, 0.001)
    // grip.object3D.position.clampLength(this.data.handleLength, this.data.handleLength)

    this.spherical.setFromCartesianCoords(grip.object3D.position.x, grip.object3D.position.y, grip.object3D.position.z)
    this.spherical.theta = Math.PI/ 2
    this.spherical.radius = this.data.handleLength
    this.spherical.phi = THREE.Math.clamp(this.spherical.phi, this.data.angleRange.x * Math.PI / 180, this.data.angleRange.y * Math.PI / 180)
    grip.object3D.position.setFromSpherical(this.spherical)

    this.bodyPositioner.object3D.matrix.lookAt(this.grip.object3D.position, this.origin, this.forward)
    Util.applyMatrix(this.bodyPositioner.object3D.matrix, this.bodyPositioner.object3D)


    this.angle = this.spherical.phi
    this.percent = THREE.Math.mapLinear(this.angle, this.data.angleRange.x * Math.PI / 180, this.data.angleRange.y * Math.PI / 180, 0, 1)
    if (this.percent > 0.99) this.percent = 1.0
    if (this.percent < 0.01) this.percent = 0
    this.value = THREE.Math.mapLinear(this.percent, 0, 1, this.data.valueRange.x, this.data.valueRange.y)
  },
  _tick(t,dt) {
    if (this.lastAngle !== this.angle)
    {
      // console.log("Updating angle again!!")
      if (this.data.target)
      {
        // console.log(this.data.target, this.data.component, this.data.property, this.value)
        if (this.data.property.length)
        {
          if (this.data.target === this.el.sceneEl) {
            this.data.target.setAttribute(this.data.component, {[this.data.property]: this.value})
          }
          else {
            this.data.target.setAttribute(this.data.component, this.data.property, this.value)
          }
        }
        else
        {
          this.data.target.setAttribute(this.data.component, this.value)
        }

        this.lastAngle = this.angle
      }
      else
      {
        this.eventDetail.angle = this.angle * 180 / Math.PI
        this.eventDetail.value = this.value
        this.eventDetail.percent = this.percent
        this.el.emit('anglechanged', this.eventDetail)
        this.lastAngle = this.angle
      }
    }
  }
})

// A lever that when pulled all the way down emits a 'click' event
AFRAME.registerComponent('slot-machine', {
  dependencies: ['lever'],
  schema: {
    // **[0..1]** How far down the lever has to be pulled to emit the event
    threshold: {default: 0.8},

    // **[0..1]** How far up past the threshold the lever has to go to be reset
    // and able to trigger the event again
    debounce: {default: 0.05},

    // How fast the lever returns to its starting position
    resetSpeed: {default: 0.8},

    // What event to emit
    event: {default: 'click'},
  },
  events: {
    anglechanged: function(e) {
      if (e.detail.value > this.data.threshold && !this.pulled)
      {
        this.el.emit('click', {type: 'slot'})
        this.pulled = true
      }
      else if (e.detail.value < this.data.threshold - this.data.debounce) {
        this.pulled = false
      }
    }
  },
  init() {
    this.tick = AFRAME.utils.throttleTick(this.tick, 10, this)
  },
  tick(t, dt) {
    if (!this.el.components.lever.grip.is("grabbed") && this.el.components.lever.value > 0) {
      this.el.components.lever.value = THREE.Math.clamp((this.el.components.lever.value || 0.0) - this.data.resetSpeed * dt / 1000, 0, 1)
      this.el.components.lever.setValue(this.el.components.lever.value)
    }
  }
})


// AFRAME.registerComponent('constrain-track-to', {
//   schema: {
//     innerRadius: {default: 0.0},
//     outerRadius: {default: 1.0},
//     constrainOnLoad: {default: true}
//   },
//   init() {
//     this.el.manipulatorConstraint = this.constrainObject.bind(this)
//     Util.whenLoaded(this.el, () => {
//       if (this.data.constrainOnLoad)
//       {
//         this.constrainObject()
//       }
//     })
//   },
//   constrainObject() {
//
//     this.el.object3D.matrix.lookAt(this.el.object3D, new THREE.Vector3(0,0,0), new THREE.Vector3(0,0,-1));
//   }
// })

// Makes the entity slow to move with the manipulator, making it feel like it
// has weight.
AFRAME.registerComponent('manipulator-weight', {
  schema: {
    // Either `'sticky'` or `'slow'`. In 'slow' mode, the entity will eventually
    // catch up to the user's hand. In sticky mode, the user must move their
    // hand further and further in order to keep moving the object.
    type: {default: 'sticky', oneOf: ['sticky', 'slow']},

    // How much weight to apply. Should be between 0.0 and 1.0. 0 is no weight
    // applied, and 1 is entity won't ever move.
    weight: {default: 0.8}
  },
  events: {
    stateadded: function(e) {
      if (e.detail === 'grabbed') {
        this.lastPos.copy(this.el.object3D.position)
        this.lastRot.copy(this.el.object3D.quaternion)
      }
    }
  },
  init() {
    this.lastPos = new THREE.Vector3()
    this.lastRot = new THREE.Quaternion()
    this.constrainObject = this.constrainObject.bind(this)
  },
  play() {
    this.el.sceneEl.systems.manipulator.installConstraint(this.el, this.constrainObject)
    this.lastPos.copy(this.el.object3D.position)
    this.lastRot.copy(this.el.object3D.quaternion)
  },
  pause() {
    this.el.sceneEl.systems.manipulator.removeConstraint(this.el, this.constrainObject)
  },
  constrainObject(t, dt) {
    var weight = this.data.weight
    if (this.data.type === 'slow') weight = 1.0 - THREE.Math.clamp((1.0 - weight) * dt / 30, 0, 1)
    // weight = 1 - Math.exp( - weight * dt )


    this.el.object3D.position.lerp(this.lastPos, weight)
    this.el.object3D.quaternion.slerp(this.lastRot, weight)

    if (this.data.type === 'slow') {
      this.lastPos.copy(this.el.object3D.position)
      this.lastRot.copy(this.el.object3D.quaternion)
    }
  }
})

AFRAME.registerComponent('manipulator-console-debug', {
  events: {
    stateremoved: function(e) {
      if (e.detail === 'grabbed')
      {
          let pos = this.el.getAttribute('position')
          let rot = this.el.getAttribute('rotation')
          let scale = this.el.getAttribute('scale')
          console.log(`position="${pos.x} ${pos.y} ${pos.z}" rotation="${rot.x} ${rot.y} ${rot.z}" scale="${scale.x} ${scale.y} ${scale.z}"`)
      }
    }
  },
  init() {
    this.el.classList.add('clickable')
  }
})

AFRAME.registerComponent('manipulator-snap-grid', {
  schema: {
    coordinates: {oneOf: ['local', 'global'], default: 'global'},
    spacing: {type: 'vec3', default: {x: 0.05, y: 0.05, z: 0.05}},
    spacingCubeSize: {default: 0.05},

    angleStep: {default: 45.0},
    scaleSteps: {default: 2.0},

    enabled: {default: true},
  },
  init() {
    this.constrainObject = this.constrainObject.bind(this)
    this.system = this.el.sceneEl.systems.manipulator
    this.postManipulation = this.postManipulation.bind(this)

    this.positioner = new THREE.Object3D
    this.el.sceneEl.object3D.add(this.positioner)

    Pool.init(this, {useSystem: true})
  },
  play() {
    if (this.el === this.el.sceneEl)
    {
      this.system.installGlobalConstraint(this.postManipulation, GRID_PRIORITY)
    }
    else
    {
      this.el.sceneEl.systems.manipulator.installConstraint(this.el, this.constrainObject, GRID_PRIORITY)
    }
  },
  pause() {
    if (this.el === this.el.sceneEl)
    {
      this.system.removeGlobalConstraint(this.postManipulation)
    }
    else
    {
      this.el.sceneEl.systems.manipulator.removeConstraint(this.el, this.constrainObject)
    }
  },
  update(oldData) {
    if (this.data.spacingCubeSize !== oldData.spacingCubeSize && this.data.spacingCubeSize > 0.0)
    {
      this.data.spacing.x = this.data.spacingCubeSize
      this.data.spacing.y = this.data.spacingCubeSize
      this.data.spacing.z = this.data.spacingCubeSize
    }
  },
  snapToGrid(object3D) {
    if (!this.data.enabled) return;

    let position = object3D.position

    let rotation = object3D.rotation


    position.x = Math.floor(position.x / this.data.spacing.x) * this.data.spacing.x
    position.y = Math.floor(position.y / this.data.spacing.y) * this.data.spacing.y
    position.z = Math.floor(position.z / this.data.spacing.z) * this.data.spacing.z

    let angleStep = this.data.angleStep * Math.PI / 180.0

    for (let v of [[0, 0, 1], [1, 0, 0]])
    {
      object3D.updateMatrixWorld()
      let dir = this.pool('dir', THREE.Vector3)
      // object3D.getWorldDirection(dir)
      let worldQuat = this.pool('worldQuat', THREE.Quaternion)
      object3D.getWorldQuaternion(worldQuat)
      dir.set(v[0],v[1],v[2])
      dir.applyQuaternion(worldQuat)
      let quaternion = this.pool('quaternion', THREE.Quaternion)
      let spherical = this.pool('spherical', THREE.Spherical)
      spherical.setFromCartesianCoords(dir.x, dir.y, dir.z)
      spherical.phi = Math.round(spherical.phi / angleStep) * angleStep
      spherical.theta = Math.round(spherical.theta / angleStep) * angleStep
      spherical.makeSafe()
      if (spherical.theta < 0)
      {
        spherical.theta += Math.PI * 2.0
      }
      let snappedDir = this.pool('snappedDir', THREE.Vector3)
      snappedDir.setFromSpherical(spherical)
      quaternion.setFromUnitVectors(dir, snappedDir)

      let originalQuaternion = this.pool('oq', THREE.Quaternion)
      originalQuaternion.copy(object3D.quaternion)
      object3D.applyQuaternion(quaternion)
      // object3D.quaternion.slerp(originalQuaternion, 0.3)
    }
  },
  constrainObject(t, dt) {
    this.snapToGrid(this.el.object3D)
  },
  postManipulation(el, localOffset) {
    if (!this.data.enabled) return;
    if (this.data.coordinates === 'global')
    {
      Util.positionObject3DAtTarget(this.positioner, el.object3D)
      this.snapToGrid(this.positioner)
      Util.positionObject3DAtTarget(el.object3D, this.positioner)

      let box = this.pool('box', THREE.Box3)
      Util.recursiveBoundingBox(el.object3D, {box})
      let maxSide = Math.max(box.max.x - box.min.x, box.max.y - box.min.y, box.max.z - box.min.z)
      let scaleSnap = (this.data.spacing.x / this.data.scaleSteps)
      let scaledMaxSide = Math.round(maxSide / scaleSnap) * scaleSnap

      if (el.hasAttribute('manipulator-weight') && Math.abs(scaledMaxSide - maxSide) < scaleSnap * 0.1) return;

      let scaleAmmount = scaledMaxSide / maxSide
      el.object3D.scale.multiplyScalar(scaleAmmount)
      // console.log("Box", scaleSnap, scaledMaxSide, maxSide, scaleAmmount, JSON.stringify(box), JSON.stringify(el.object3D.scale))

      // this.positioner.scale.set(
      //   this.positioner.scale.x / (Math.round((box.max.x - box.min.x) / (this.data.spacing.x / this.data.scaleSteps)) * this.data.spacing.x / this.data.scaleSteps),
      //   this.positioner.scale.y / (box.max.y - box.min.y),
      //   // this.positioner.scale.y / (Math.round((box.max.y - box.min.y) / (this.data.spacing.y / this.data.scaleSteps)) * this.data.spacing.y / this.data.scaleSteps),
      //   this.positioner.scale.z,
      // )
      //
      // Util.positionObject3DAtTarget(el.object3D, this.positioner)
    }
    else
    {
      this.snapToGrid(this.el.object3D)
    }
  }
})

// AFRAME.registerComponent('manipulator-global-constraint-proxy', {
//   init() {
//     this.system = this.el.sceneEl.systems.manipulator
//     this.postManipulation = this.postManipulation.bind(this)
//   },
//   play() {
//     this.system.postManipulationCallbacks.push(this.postManipulation)
//   },
//   pause() {
//     this.system.postManipulationCallbacks.splice(this.system.postManipulationCallbacks.indexOf(this.postManipulation), 1)
//   },
//   postManipulation(el, localOffset) {
//     console.log("postManipulation", el)
//     let t = this.el.sceneEl.time
//     let dt = this.el.sceneEl.delta
//
//     if (this.el.manipulatorConstraint) this.el.manipulatorConstraint(t, dt)
//     if (this.el.manipulatorConstraints) {
//       for (let c of this.el.manipulatorConstraints)
//       {
//
//         c(t,dt, localOffset)
//       }
//     }
//   }
// })

AFRAME.registerComponent('manipulator-lock', {
  schema: {
    // Which axes are explicitly locked by this constraint and can't be moved at all.
    // Should be some combination of `x`, `y`, `z`
    lockedPositionAxes: {type: 'array', default: []},
    lockedRotationAxes: {type: 'array', default: []},
    lockedScaleAxes: {type: 'array', default: []},
  },
  events: {
    stateadded: function(e) {
      if (e.detail === 'grabbed')
      {
        this.setLocks()
      }
    }
  },
  init() {
    this.lockedPosition = new THREE.Vector3;
    this.lockedRotation = new THREE.Euler;
    this.lockedScale = new THREE.Vector3;
    this.constrainObject = this.constrainObject.bind(this)
  },
  play() {
    this.el.sceneEl.systems.manipulator.installConstraint(this.el, this.constrainObject, CONSTRAINT_PRIORITY)
  },
  pause() {
    console.log("Removing lock constraint")
    this.el.sceneEl.systems.manipulator.removeConstraint(this.el, this.constrainObject)
  },
  remove() {
    this.pause()
  },
  constrainObject(t, dt) {
    let obj = this.el.object3D
    for (let axis of ['x', 'y', 'z'])
    {
      if (this.data.lockedPositionAxes.indexOf(axis) >= 0)
      {
        obj.position[axis] = this.lockedPosition[axis]
      }
      if (this.data.lockedRotationAxes.indexOf(axis) >= 0)
      {
        obj.rotation[axis] = this.lockedRotation[axis]
      }
      if (this.data.lockedScaleAxes.indexOf(axis) >= 0)
      {
        obj.scale[axis] = this.lockedScale[axis]
      }
    }
  },
  setLocks() {
    console.log("Setting constraint locks")
    let obj = this.el.object3D
    this.lockedPosition.copy(obj.position)
    this.lockedRotation.copy(obj.rotation)
    this.lockedScale.copy(obj.scale)
  },
  update(oldData) {
    this.setLocks()
  },
})
