import { computeBoundsTree, disposeBoundsTree, acceleratedRaycast } from './three-mesh-bvh.js';

// Add the extension functions
THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
THREE.BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree;
THREE.Mesh.prototype.raycast = acceleratedRaycast;

THREE.MeshBVH = require('./three-mesh-bvh.js')
