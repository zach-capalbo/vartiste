import {Pool} from './pool.js'
import {Util} from './util.js'

// Helper for positioning the user
Util.registerComponentSystem('artist-root', {
  schema: {
    rotationAmount: {default: 3.14 / 4}
  },
  events: {
    entervr: function() {}
  },
  init() {
    Pool.init(this)

    document.querySelectorAll('*[laser-controls]').forEach(el => {
      el.addEventListener('buttonchanged', e => {
        if (this.acceptOrientationPrompt())
        {
          e.preventDefault()
          e.stopPropagation()
        }
      })
    })

    document.querySelectorAll('*[cursor]').forEach(el => {
      el.addEventListener('mouseup', () => this.acceptOrientationPrompt())
    })
  },

  // Rotates the user's viewport left
  rotateLeft() {
    document.querySelector('#camera-offsetter').components['between-target-positioner'].resetPosition()
    document.querySelector('#artist-root').object3D.rotation.y += this.data.rotationAmount;
  },

  // Rotates the user's viewport right
  rotateRight() {
    document.querySelector('#camera-offsetter').components['between-target-positioner'].resetPosition()
    document.querySelector('#artist-root').object3D.rotation.y -= this.data.rotationAmount;
  },
  resetPosition() {
    document.querySelector('#camera-offsetter').components['between-target-positioner'].resetPosition()
  },

  // Forces the camera back to it's original spot, no matter how the user has
  // moved around.
  resetCameraLocation() {
    this.resetPosition()
    let targetObj = document.querySelector('#artist-root').object3D
    let positioner = document.querySelector('#camera-reset-el')
    Util.positionObject3DAtTarget(targetObj, positioner.object3D)

    let cameraWorld = this.pool('cameraWorld', THREE.Vector3)
    let cameraObj = Util.cameraObject3D()
    cameraObj.getWorldPosition(cameraWorld)
    targetObj.position.y -= cameraWorld.y

    this.resetPosition()

    targetObj.rotation.set(0, 0, 0)
    targetObj.updateMatrixWorld()

    cameraObj.getWorldDirection(cameraWorld)
    cameraWorld.y = 0
    cameraWorld.normalize()

    let rotationMatrix = this.pool('rotMat', THREE.Matrix4)


    // rotationMatrix.getInverse(rotationMatrix)
    // rotationMatrix.extractRotation(targetObj.matrixWorld)


    // cameraWorld.applyMatrix4(rotationMatrix)


    // targetObj.matrix.lookAt(cameraWorld, new THREE.Vector3, targetObj.up)
    // rotationMatrix.extractRotation(targetObj.matrix)
    // rotationMatrix.getInverse(rotationMatrix)
    // // targetObj.matrix.multiply(rotationMatrix)
    // rotationMatrix.decompose(cameraWorld, targetObj.quaternion, cameraWorld)
    //
    // // Util.applyMatrix(targetObj.matrix, targetObj)
    // targetObj.rotation.x = 0
    // targetObj.rotation.z = 0
    // targetObj.rotation.y = - targetObj.rotation.y

    let forward = this.pool('forward', THREE.Vector3)
    forward.set(0, 0, 1)

    console.log("wd", cameraWorld, cameraWorld.angleTo(forward))
    targetObj.rotateY(cameraWorld.angleTo(forward))
  },

  // Shows the prompt
  showOrientationResetPrompt() {
    this.waitingForPrompt = true
    this.el.sceneEl.querySelector('#world-root').setAttribute('visible', false)
    this.el.sceneEl.querySelector('#reset-orientation-box').setAttribute('visible', true)
    this.el.sceneEl.emit('refreshobjects')
  },
  acceptOrientationPrompt() {
    if (!this.waitingForPrompt) return false
    this.waitingForPrompt = false

    this.resetCameraLocation()
    this.el.sceneEl.querySelector('#world-root').setAttribute('visible', true)
    this.el.sceneEl.querySelector('#reset-orientation-box').setAttribute('visible', false)
    this.el.sceneEl.emit('refreshobjects')

    return true
  }
})

AFRAME.registerComponent('between-target-positioner', {
  schema: {
    root: {type: 'selector'},
    target: {type: 'selector'},
  },
  init() {
    // this.tick = AFRAME.utils.throttleTick(this.tick, 1000, this)
    Pool.init(this)
  },
  resetPosition() {
    let targetObj = this.data.target.object3D
    let rootObj = this.data.root.object3D
    let thisObj = this.el.object3D

    let oldY = rootObj.position.y

    let rot = rootObj.matrix.extractRotation(new THREE.Matrix4)

    let diff = this.pool('diff', THREE.Vector3)
    // let diff = new THREE.Vector3

    diff.copy(targetObj.position)
    diff.add(thisObj.position)

    diff.applyQuaternion(rootObj.quaternion)

    // console.log("Reset Position", targetObj.position, thisObj.position, rootObj.position, diff, rot, rootObj.quaternion)

    rootObj.position.add(diff)
    rootObj.position.y = oldY

    thisObj.position.x = - targetObj.position.x
    thisObj.position.z = - targetObj.position.z
  },
  // tick(t,dt) {
  //   this.resetPosition()
  // }
})

AFRAME.registerComponent('reset-transform-on-vr', {
  dependencies: ["look-controls"],
  init() {
    this.el.components['look-controls'].onEnterVR = (function () {


      // if (!this.el.sceneEl.checkHeadsetConnected()) { return; }
      this.saveCameraPose();
      this.el.object3D.position.set(0, 0, 0);
      this.el.sceneEl.systems['artist-root'].showOrientationResetPrompt()
      return
      // this.el.object3D.updateMatrix();
    }).bind(this.el.components['look-controls'])
  }
})

// Workaround for the `look-controls` not updating the matrix
AFRAME.registerComponent('camera-matrix-helper', {
  dependencies: ['camera'],
  init() {
    this.obj = new THREE.Object3D
    this.el.setObject3D('camera-matrix-helper', this.obj)
    this.el.object3D.parent.add(this.obj)
    Util.whenLoaded(document.getElementById('camera-root'), () => this.cameraObject = document.getElementById('camera-root').object3D)
  },
  tick() {
    this.obj.matrix.compose(this.cameraObject.position, this.cameraObject.quaternion, this.cameraObject.scale)
    this.obj.matrix.decompose(this.obj.position, this.obj.quaternion, this.obj.scale)
  }
})
