import {Axes} from './joystick-directions.js'
import {Undo} from './undo.js'

AFRAME.registerComponent('manipulator', {
  dependencies: ['raycaster'],
  schema: {
    selector: {type: 'string'},
    useRay: {type:'boolean', default: true},
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
      this.objects = this.objects.filter(o => {
        if (o.el.classList.contains("raycast-invisible")) return false
        if (o.el.hasAttribute('visible') && !o.el.getAttribute('visible')) return false
        if (!o.visible) return false

        let parentVisible = true
        o.traverseAncestors(a => parentVisible = parentVisible && a.visible)
        if (!parentVisible) return false

        return true
      })
    }

    this.el.sceneEl.addEventListener('refreshobjects', e => {
      this.raycaster.refreshObjects()
    })

    // Default grab-options
    this.el.setAttribute('grab-options', "")
  },
  startGrab() {
    if (this.target.grabbingManipulator) {
      // stopGrab()
      return
    }

    this.target.addState("grabbed")

    this.grabOptions = this.target.hasAttribute('grab-options') ? this.target.getAttribute('grab-options') : this.el.getAttribute('grab-options')

    let startMatrix = new THREE.Matrix4
    startMatrix.copy(this.target.object3D.matrix)
    let obj3d = this.target.object3D
    Undo.push(() => {
      obj3d.matrix.copy(startMatrix)
      obj3d.matrix.decompose(obj3d.position, obj3d.quaternion, obj3d.scale)
    })

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
    if (this.data.printUpdates)
    {
      console.log(this.target,
                  "\n\nposition=\"" + AFRAME.utils.coordinates.stringify(this.target.object3D.position) +"\"",
                  "\n\nrotation=\"" + AFRAME.utils.coordinates.stringify({
                    x: THREE.Math.radToDeg(this.target.object3D.rotation.x),
                    y: THREE.Math.radToDeg(this.target.object3D.rotation.y),
                    z: THREE.Math.radToDeg(this.target.object3D.rotation.z),
                  }) + "\"")
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
  onGripClose(){
    if (this.data.useRay)
    {
      if (!this.raycaster.intersectedEls.length > 0)
      {
        return
      }

      let targetEl = this.raycaster.intersectedEls[0]
      let intersection = this.raycaster.getIntersection(targetEl)

      console.log("GRABBING", targetEl, intersection)
      this.target = targetEl

      for (let redirection = targetEl['redirect-grab']; redirection; redirection = this.target['redirect-grab'])
      {
        console.log("Redirecting grab to", typeof(redirection), redirection)
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

          console.log(rotAxis)

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
            this.target.object3D.scale.multiplyScalar(1.0 - (0.2 * this.scaleAmmount * dt / 100))
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
    }
  }
})

AFRAME.registerComponent('mouse-manipulator', {
  dependencies: ["manipulator"],
  init() {
    this.el.setAttribute('manipulator', {useRay: true})
    document.addEventListener('mousedown', e => {
      console.log("Click grabbing")
      if (!e.shiftKey) return
      let allowLeftClick = true
      if (!allowLeftClick && (!e.buttons || e.buttons == 1)) return
      this.el.components.manipulator.onGripClose()
    })

    document.addEventListener('mouseup', e=> {
      console.log("Clcik releasing")
      // if (e.button == 0) return
      this.el.components.manipulator.onGripOpen()
    })
  },
})

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

AFRAME.registerComponent('grab-options', {
  schema: {
    showHand: {type: 'boolean', default: true},
    scalable: {type: 'boolean', default: true}
  }
})

AFRAME.registerComponent('lock-axes', {
  schema: {
    x: {type: 'float', default: NaN},
    y: {type: 'float', default: NaN},
    z: {type: 'float', default: NaN},
  },
  tick() {
    return
    for (let axis in this.data)
    {
      let val = this.data[axis];
      if (Number.isFinite(val))
      {
        this.el.object3D.rotation[axis] = val * Math.PI / 180
      }
    }
  }
})
