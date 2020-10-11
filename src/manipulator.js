import {Axes} from './joystick-directions.js'
import {Undo} from './undo.js'
import {Util} from './util.js'
import {Pool} from './pool.js'

AFRAME.registerSystem('manipulator', {
  init() {
    this.postManipulationCallbacks = []
  },
  postManipulation(el) {
    if (!this.postManipulationCallbacks.length) return

    for (let c of this.postManipulationCallbacks)
    {
      c(el)
    }
  },
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
  dependencies: ['raycaster'],
  schema: {
    // Note: **Don't Use**
    selector: {type: 'string'},
    // Note: **Don't Use**
    useRay: {type:'boolean', default: true},
    // Logs debug messages to the console
    printUpdates: {type: 'boolean', default: false}
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

    this.grabLine = new THREE.Geometry();
    this.grabLine.vertices.push(new THREE.Vector3(0,0,0));
    this.grabLine.vertices.push(new THREE.Vector3(0,0,4));
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
        if (o.el.classList.contains("raycast-invisible")) continue
        if (o.el.hasAttribute('visible') && !o.el.getAttribute('visible')) continue
        if (!o.visible) continue

        let parentVisible = true
        o.traverseAncestors(a => parentVisible = parentVisible && a.visible)
        if (!parentVisible) continue

        this.objects[j++] = o
      }
      this.objects.length = j
    }

    this.el.sceneEl.addEventListener('refreshobjects', e => {
      this.raycaster.refreshObjects()
    })

    // Default grab-options
    this.el.setAttribute('grab-options', "")
  },
  startGrab() {
    if (this.target.grabbingManipulator) {
      this.target = undefined
      // stopGrab()
      return
    }

    this.target.addState("grabbed")

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

    this.target.grabbingManipulator = this

    let targetQuart = this.pool("targetQuart", THREE.Quaternion)
    this.rightHand.object3D.getWorldQuaternion(targetQuart)
    this.startPoint.setRotationFromQuaternion(targetQuart)
    this.rightHand.object3D.getWorldPosition(this.startPoint.position)

    this.startPoint.updateMatrixWorld()
    this.invM.getInverse(this.startPoint.matrixWorld)

    this.target.object3D.updateMatrixWorld()

    this.target.object3D.getWorldPosition(this.endPoint.position)
    this.startPoint.worldToLocal(this.endPoint.position)

    this.startPoint.updateMatrixWorld()

    let pmw = this.pool('pmw', THREE.Matrix4)
    pmw.getInverse(this.startPoint.matrixWorld)

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

    this.grabLine.vertices[1].set(this.endPoint.position.x, this.endPoint.position.y, this.endPoint.position.z)
    this.grabLine.verticesNeedUpdate = true;
    this.grabLineObject.visible = true
    this.endPoint.visible = true;

    this.grabber.object3D.visible = this.grabOptions.showHand
    // this.grabber.object3D.parent.remove(this.grabber.object3D)
    this.endPoint.attach(this.grabber.object3D)
    this.grabber.object3D.position.set(0,0,0)
    this.grabber.object3D.rotation.set(0,0,0)
    this.grabber.object3D.scale.set(0.4, 0.4, 0.4)
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
  },
  onGripClose(e){
    if (e) {
      e.preventDefault()
      e.stopPropagation()
    }

    if (this.el.is('grabbing')) return

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
    this.stopGrab()

    if (this.data.printUpdates)
    {
      console.log("GripOpen")
    }
  },
  tick(t, dt) {
    if (this.target) {
      if (Math.abs(this.zoomAmmount) > 0.08)
      {
        if (this.el.is("orbiting"))
        {
          // let quart = this.pool("quart", THREE.Quaternion)
          let rotAxis = this.pool("axis", THREE.Vector3).set(1, 0, 0)

          // quart.setFromAxisAngle(rotAxis, this.zoomAmmount * dt / 300)

          // this.endPoint.quaternion.multiply(quart)
          // let invm = this.pool("invm", THREE.Matrix4)
          // invm.getInverse(this.endPoint.matrix)
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
            this.target.object3D.scale.multiplyScalar(scaleFactor)
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
      pmw.getInverse(this.target.object3D.parent.matrixWorld)

      this.endPoint.getWorldQuaternion(quart)

      if (this.el.is('rotating') || this.el.is('orbiting'))
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

      if (this.resetZoom) {
        this.zoomAmmount = 0
        this.scaleAmmount = 0
        this.resetZoom = false
      }

      if (this.target.manipulatorConstraint) this.target.manipulatorConstraint()
      this.system.postManipulation(this.target)
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
  }
})

// Redirects a grab from the [`manipulator`](#manipulator) to the closest to the
// selector target
AFRAME.registerComponent('redirect-grab', {
  // Element that will
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
    undoable: {type: 'boolean', default: false}
  }
})

// Locks the objects up direction, even when it is grabbed and rotated by the [Manipulator](#manipulator)
AFRAME.registerComponent('lock-up', {
  schema: {
    // x: {type: 'float', default: NaN},
    // y: {type: 'float', default: NaN},
    // z: {type: 'float', default: NaN},
  },
  init() {
    this.el.manipulatorConstraint = this.constrainObject.bind(this)
    Pool.init(this)
  },
  constrainObject() {
    let forward = this.pool('forward', THREE.Vector3)
    let obj = this.el.object3D

    forward.set(0, 0, 1)
    forward.applyQuaternion(obj.quaternion)
    forward.y = 0
    forward.normalize()

    obj.matrix.lookAt(forward, this.pool('origin', THREE.Vector3), this.el.sceneEl.object3D.up)
    obj.quaternion.setFromRotationMatrix(obj.matrix)

    // obj.getWorldDirection(forward)

  }
})

// The first time an element with this component is grabbed, it will emit the
// `activate` event.
AFRAME.registerComponent('grab-activate', {
  init() {
    let activate = (e) => {
      if (e.detail === 'grabbed') {
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
    this.el.sceneEl.systems.manipulator.postManipulationCallbacks.push((el) => {
      this.el.setAttribute('text', 'value', `position="${AFRAME.utils.coordinates.stringify(el.object3D.position)}"\nrotation="${AFRAME.utils.coordinates.stringify({
        x: THREE.Math.radToDeg(el.object3D.rotation.x),
        y: THREE.Math.radToDeg(el.object3D.rotation.y),
        z: THREE.Math.radToDeg(el.object3D.rotation.z),
      })}"\nscale="${AFRAME.utils.coordinates.stringify(el.object3D.scale)}"`)
    })
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
AFRAME.registerComponent('constrain-to-sphere', {
  schema: {
    innerRadius: {default: 0.0},
    outerRadius: {default: 1.0},
    constrainOnLoad: {default: true}
  },
  init() {
    this.el.manipulatorConstraint = this.constrainObject.bind(this)
    Util.whenLoaded(this.el, () => {
      if (this.data.constrainOnLoad)
      {
        this.constrainObject()
      }
    })
  },
  constrainObject() {
    this.el.object3D.position.clampLength(this.data.innerRadius, this.data.outerRadius)
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
