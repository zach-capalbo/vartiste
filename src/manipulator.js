AFRAME.registerComponent('manipulator', {
  schema: {
    selector: {type: 'string'},
    useRay: {type:'boolean', default: true},
    printUpdates: {type: 'boolean', default: true},
    lockAxes: {type: 'array', default: []} // NYI
  },
  init() {
    this.rightHand = this.el

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

    this.raycaster = new THREE.Raycaster();

    var geometry = new THREE.BoxGeometry( 0.1, 0.1, 0.1 );
    this.startPoint.add(new THREE.Mesh( geometry, new THREE.MeshBasicMaterial( {color: 0x00ff00} ) ))
    this.endPoint.add(new THREE.Mesh( geometry, new THREE.MeshBasicMaterial( {color: 0xff0000} ) ))

  },
  startGrab() {
    this.el.addState('grabbing')
    let targetQuart = new THREE.Quaternion()
    this.rightHand.object3D.getWorldQuaternion(targetQuart)
    this.startPoint.setRotationFromQuaternion(targetQuart)
    this.rightHand.object3D.getWorldPosition(this.startPoint.position)

    this.startPoint.updateMatrixWorld()
    this.invM.getInverse(this.startPoint.matrixWorld)

    // this.target.object3D.updateMatrixWorld()
    // this.endPoint.matrix.copy(this.target.object3D.matrixWorld)
    // this.endPoint.applyMatrix(this.invM)

    this.target.object3D.getWorldPosition(this.endPoint.position)
    this.startPoint.worldToLocal(this.endPoint.position)

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
    this.el.removeState('grabbing')
  },
  onGripClose(){
    if (this.data.useRay) {

      var bone = this.el.getObject3D('mesh');//.skeleton.getBoneByName('Palm')
      var position = new THREE.Vector3()
      bone.getWorldPosition(position)
      var matrix = new THREE.Matrix4()
      matrix.extractRotation(bone.matrixWorld)

      var directions = [
        [new THREE.Vector3(0, 0, -1), 0.3],
        [new THREE.Vector3(0, -1, 0), 0.3],
        [new THREE.Vector3(0, 1, 0), 0.3],
        // [new THREE.Vector3(0, 1, 0), 0.01]
      ]

      for (var direction of directions)
      {
        direction[0].applyMatrix4(matrix)
        this.raycaster.set(position, direction[0])
        this.raycaster.far=direction[1];

        for (var el of document.querySelectorAll(this.data.selector))
        {
          if (!el.object3D)
          {
            continue;
          }

          if (el === this.el)
          {
            continue
          }

          if (el === this.el.sceneEl)
          {
            continue
          }

          var collisionDetail = this.raycaster.intersectObject(el.object3D, true)

          if (collisionDetail.length > 0)
          {
            this.target = el
            console.log("Grabbing", el)
            this.startGrab()
            return
          }
        }
      }
    }
    else
    {
      this.target = document.querySelector(this.data.selector)
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

      this.endPoint.getWorldPosition(this.target.object3D.position)
      if (this.target.object3D.parent) this.target.object3D.parent.worldToLocal(this.target.object3D.position)
      this.endPoint.getWorldQuaternion(quart)
      // this.target.object3D.setRotationFromQuaternion(quart)

      // this.target = undefined
    }
  }
})
