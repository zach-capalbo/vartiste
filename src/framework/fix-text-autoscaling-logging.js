let o = THREE.BufferGeometry.prototype.fromGeometry
THREE.BufferGeometry.prototype.fromGeometry = function(g) {
  // Suppress the "Faceless geometries are not supported " error
  if (g.faces.length === 0) {
    return this;
  }
  return o.call(this, g)
}
// 
// let originalBufferGeometry = THREE.BufferGeometry
//
// THREE.BufferGeometry = function BufferGeometry() {
//
// 	this.id = new originalBufferGeometry().id
//
// 	this.uuid = THREE.MathUtils.generateUUID();
//
// 	this.name = '';
// 	this.type = 'BufferGeometry';
//
// 	this.index = null;
// 	this.attributes = {};
//
// 	this.morphAttributes = {};
// 	this.morphTargetsRelative = false;
//
// 	this.groups = [];
//
// 	this.boundingBox = null;
// 	this.boundingSphere = null;
//
// 	this.drawRange = { start: 0, count: Infinity };
//
// 	this.userData = {};
// }
//
// Object.assign(THREE.BufferGeometry.prototype, originalBufferGeometry.prototype)
