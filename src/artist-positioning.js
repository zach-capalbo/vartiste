import {Util} from './util.js'
import {Pool} from './pool.js'

// Helper for positioning the user
Util.registerComponentSystem('artist-root', {
  schema: {
    rotationAmount: {default: 3.14 / 4},

    // Automatically reset the user's position (including prompt to reset) when entering VR
    autoResetPosition: {default: true},

    //
    // addLight: {default: true},

  },
  events: {
    entervr: function() {}
  },
  init() {
    Pool.init(this)

    document.querySelectorAll('*[cursor], *[webxr-laser]').forEach(el => {
      el.addEventListener('buttonchanged', e => {
        if (this.acceptOrientationPrompt())
        {
          e.preventDefault()
          e.stopPropagation()
        }
      })
    })

    document.querySelectorAll('*[cursor], *[webxr-laser]').forEach(el => {
      el.addEventListener('mouseup', () => this.acceptOrientationPrompt())
    })

    let resetBox = this.el.sceneEl.querySelector('#reset-orientation-box')
    if (!resetBox)
    {
      resetBox = document.createElement('a-box')
      resetBox.setAttribute('width', '500')
      resetBox.setAttribute('depth', '500')
      resetBox.setAttribute('height', '500')
      resetBox.setAttribute('material', "src: #asset-reset-orientation; side: back; shader: flat")
      resetBox.setAttribute('visible', false)
      this.el.sceneEl.append(resetBox)
    }
    this.resetBox = resetBox

    Util.whenLoaded(this.el.sceneEl, () => {
      if (this.el.sceneEl.is('vr-mode'))
      {
        if (AFRAME.utils.device.isMobile() && !AFRAME.utils.device.isMobileVR()) return
        if (!this.data.autoResetPosition) return
        this.resetCameraLocation()
      }
    })

    window.addEventListener('keyup', (event) => {
      this.acceptOrientationPrompt()
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
  //   document.querySelector('#camera-offsetter').object3D.position.set(0, 0, 0);
  //   document.querySelector('#camera-offsetter').object3D.rotation.set(0, 0, 0);
  //
  //   document.querySelector('#artist-root').object3D.rotation.set(0, 0, 0)
  //   document.querySelector('#artist-root').object3D.position.set(0, 0, 0)
  //
  //   let positioner = document.querySelector('#camera-reset-el').object3D;
  //   let cameraObj = Util.cameraObject3D()
  //
  //   document.querySelector('#artist-root').object3D.position.set(
  //     positioner.position.x - cameraObj.position.x,
  //     positioner.position.y - cameraObj.position.y,
  //     positioner.position.z - cameraObj.position.z
  //   )
  //
  //   console.log(document.querySelector('#artist-root').object3D.position,
  // positioner.position, cameraObj.position)
  //
  //   return
    this.resetPosition()
    // return;

    let targetObj = document.querySelector('#artist-root').object3D
    let positioner = document.querySelector('#camera-reset-el')
    Util.positionObject3DAtTarget(targetObj, positioner.object3D)

    let cameraWorld = this.pool('cameraWorld', THREE.Vector3)
    let cameraObj = Util.cameraObject3D()
    cameraObj.getWorldPosition(cameraWorld)
    console.log("cameraWorld", cameraWorld)
    targetObj.position.y -= cameraWorld.y - positioner.object3D.position.y

    this.resetPosition()

    targetObj.rotation.set(0, 0, 0)
    targetObj.updateMatrixWorld()

    cameraObj.getWorldDirection(cameraWorld)
    cameraWorld.y = 0
    cameraWorld.normalize()

    let rotationMatrix = this.pool('rotMat', THREE.Matrix4)

    let forward = this.pool('forward', THREE.Vector3)
    forward.set(0, 0, 1)

    console.log("wd", cameraWorld, cameraWorld.angleTo(forward))
    targetObj.rotateY(cameraWorld.angleTo(forward))
  },

  // Shows the prompt
  showOrientationResetPrompt() {
    this.waitingForPrompt = true
    let worldRoot = this.el.sceneEl.querySelector('#world-root')
    if (worldRoot) worldRoot.setAttribute('visible', false)
    this.resetBox.setAttribute('visible', true)
    this.el.sceneEl.emit('refreshobjects')
  },
  acceptOrientationPrompt() {
    if (!this.waitingForPrompt) return false
    this.waitingForPrompt = false

    this.resetCameraLocation()
    let worldRoot = this.el.sceneEl.querySelector('#world-root')
    if (worldRoot) worldRoot.setAttribute('visible', true)
    this.resetBox.setAttribute('visible', false)
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

      if (AFRAME.utils.device.isMobile() && !AFRAME.utils.device.isMobileVR())
      {
        this.el.sceneEl.systems['artist-root'].resetCameraLocation()
        return
      }

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

AFRAME.registerComponent('artist-shadow', {
  tick() {
    Util.cameraObject3D().getWorldPosition(this.el.object3D.position)
    this.el.object3D.position.y = 0.01
  }
})
