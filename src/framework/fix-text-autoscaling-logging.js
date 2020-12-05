let o = THREE.BufferGeometry.prototype.fromGeometry
THREE.BufferGeometry.prototype.fromGeometry = function(g) {
  // Suppress the "Faceless geometries are not supported " error
  if (g.faces.length === 0) {
    return this;
  }
  return o.call(this, g)
}
