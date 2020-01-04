AFRAME.registerComponent('manipulator', {
  dependencies: ['raycaster', 'laser-controls'],
  schema: {
    selector: {type: 'string'},
    useRay: {type:'boolean', default: true},
    printUpdates: {type: 'boolean', default: false},
    lockAxes: {type: 'array', default: []} // NYI
  },
  init() {
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
      this.zoomAmmount = e.detail.axis[1]
      this.scaleAmmount = - e.detail.axis[0]
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
        if (!o.visible) return false

        let parentVisible = true
        o.traverseAncestors(a => parentVisible = parentVisible && a.visible)
        if (!parentVisible) return false

        return true
      })
    }
  },
  startGrab() {
    this.el.addState('grabbing')
    let targetQuart = new THREE.Quaternion()
    this.rightHand.object3D.getWorldQuaternion(targetQuart)
    this.startPoint.setRotationFromQuaternion(targetQuart)
    this.rightHand.object3D.getWorldPosition(this.startPoint.position)

    this.startPoint.updateMatrixWorld()
    this.invM.getInverse(this.startPoint.matrixWorld)

    this.target.object3D.updateMatrixWorld()
    // this.endPoint.matrix.copy(this.target.object3D.matrixWorld)
    // this.endPoint.applyMatrix(this.invM)

    this.target.object3D.getWorldPosition(this.endPoint.position)
    this.startPoint.worldToLocal(this.endPoint.position)
    // this.endPoint.position.add(this.offset)

    if (this.offset)
    {
      let startOffset = new THREE.Vector3(0,0,0)
      startOffset.copy(this.offset)

      this.endPoint.position.copy(this.offset)
      this.startPoint.worldToLocal(this.endPoint.position)
      this.endPoint.updateMatrixWorld()

      // Offset still in world space

      let twp = new THREE.Vector3(0,0,0)
      this.target.object3D.getWorldPosition(twp)
      this.offset.sub(twp)

      // offset now difference between intersection and target origin in world space

      let quart = new THREE.Quaternion();
      this.target.object3D.getWorldQuaternion(quart)
      this.offset.applyQuaternion(quart.conjugate());

      let ws = new THREE.Vector3(0,0,0)
      this.target.object3D.parent.getWorldScale(ws)
      this.offset.divide(ws)
      console.log("Offset", this.offset)
      console.log("WS Offset", startOffset)
      console.log("WS Target", twp)
      console.log("Parent WS", ws)
    }

    this.grabLine.vertices[1].set(this.endPoint.position.x, this.endPoint.position.y, this.endPoint.position.z)
    this.grabLine.verticesNeedUpdate = true;
    this.grabLineObject.visible = true
    this.endPoint.visible = true;

    this.grabber.object3D.visible = true
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
    if (this.data.selector)
    {
      this.stopGrab()
    }
  },
  tick(t, dt) {
    if (this.target) {
      if (Math.abs(this.zoomAmmount) > 0.08)
      {
        this.endPoint.position.multiplyScalar(1.0 - (0.2 * this.zoomAmmount * dt / 100))
      }

      if (Math.abs(this.scaleAmmount) > 0.08)
      {
        this.target.object3D.scale.multiplyScalar(1.0 - (0.2 * this.scaleAmmount * dt / 100))
      }

      this.rightHand.object3D.getWorldPosition(this.startPoint.position)

      var quart = new THREE.Quaternion()
      this.rightHand.object3D.getWorldQuaternion(quart)
      this.startPoint.setRotationFromQuaternion(quart)
      this.startPoint.updateMatrixWorld()
      this.endPoint.updateMatrixWorld()

      this.endPoint.getWorldPosition(this.target.object3D.position)
      if (this.target.object3D.parent) this.target.object3D.parent.worldToLocal(this.target.object3D.position)

      let localOffset = new THREE.Vector3()
      localOffset.copy(this.offset)

      let pws = new THREE.Vector3()

      // if (this.target.object3D.parent) this.target.object3D.getWorldScale().worldToLocal(localOffset)

      this.target.object3

      this.target.object3D.position.sub(localOffset)
      this.endPoint.getWorldQuaternion(quart)
      // this.target.object3D.setRotationFromQuaternion(quart)

      // this.target = undefined
    }
  }
})
