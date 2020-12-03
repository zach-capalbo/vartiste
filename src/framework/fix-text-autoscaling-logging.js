let o = THREE.BufferGeometry.prototype.fromGeometry
THREE.BufferGeometry.prototype.fromGeometry = function(g) {
  // Suppress the "Faceless geometries are not supported " error
  if (g.faces.length === 0) {
    return this;
  }
  return o.call(this, g)
}

let oldRayCast = THREE.Mesh.prototype.raycast
var wasSkinned = false

THREE.Mesh.prototype.raycast = function(...args) {
  wasSkinned = this.isSkinnedMesh
  this.isSkinnedMesh = this.isSkinnedMesh && this.material.skinning
  let res = oldRayCast.call(this, ...args)
  this.isSkinnedMesh = wasSkinned
  return res
}
