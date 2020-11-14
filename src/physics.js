import {Util} from './util.js'
import {Pool} from './pool.js'

AFRAME.registerComponent('ammo-fit-children', {
  init() {
    Pool.init(this)
    Util.whenLoaded(this.el, () => this.fitChildren())
  },
  fitChildren() {
    let boundingBox = this.pool('boundingBox', THREE.Box3)
    let tmpBox = this.pool('tmpBox', THREE.Box3)
    boundingBox.makeEmpty()

    let invMat = this.pool('invMat', THREE.Matrix4)
    this.el.object3D.updateMatrixWorld()
    invMat.getInverse(this.el.object3D.matrixWorld)

    this.el.object3D.traverseVisible(mesh => {
      if (!mesh.geometry) return

      mesh.geometry.computeBoundingBox()
      tmpBox.copy(mesh.geometry.boundingBox)
      tmpBox.applyMatrix4(mesh.matrixWorld)
      tmpBox.applyMatrix4(invMat)
      boundingBox.union(tmpBox)
    })

    let size = this.pool('boxSize', THREE.Vector3)
    boundingBox.getSize(size)

    console.log("Box", boundingBox)

    return

    this.el.setAttribute('ammo-shape', 'fit', 'manual')
    this.el.setAttribute('ammo-shape', 'halfExtents', `${size.x * 2} ${size.y  * 2} ${size.z * 2}`)
  },
  makeDynamic() {
    let shape = AFRAME.utils.clone(this.el.getAttribute('ammo-shape'))
    this.el.removeAttribute('ammo-body')
    this.el.setAttribute('ammo-body', 'type', 'dynamic')
    this.el.setAttribute('ammo-shape', shape)
  }
})
