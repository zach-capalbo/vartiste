import {Pool} from './pool.js'
import {Util} from './util.js'
AFRAME.registerSystem('artist-root', {
  schema: {
    rotationAmount: {default: 3.14 / 4}
  },
  rotateLeft() {
    document.querySelector('#camera-offsetter').components['between-target-positioner'].resetPosition()
    document.querySelector('#artist-root').object3D.rotation.y += this.data.rotationAmount;
  },
  rotateRight() {
    document.querySelector('#camera-offsetter').components['between-target-positioner'].resetPosition()
    document.querySelector('#artist-root').object3D.rotation.y -= this.data.rotationAmount;
  },
  resetPosition() {
    document.querySelector('#camera-offsetter').components['between-target-positioner'].resetPosition()
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
      console.log("New neter")

      // if (!this.el.sceneEl.checkHeadsetConnected()) { return; }
      this.saveCameraPose();
      this.el.object3D.position.set(0, 0, 0);
      return
      this.el.object3D.updateMatrix();
    }).bind(this.el.components['look-controls'])
  }
})

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
