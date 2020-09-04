// Adapted from https://codepen.io/maurizzzio/pen/pERqxV?editors=0010

function closestPointOnMesh(point, mesh) {
  let geometry = mesh.geometry
  let numFaces = geometry.position.count / 3

  let normal = new THREE.Vector3()
  let va = new THREE.Vector3()
  let vb = new THREE.Vector3()
  let vc = new THREE.Vector3()
  let pd = new THREE.Vector3()

  let minDistance = Number.MAX_VALUE

  let faceVertex = (v, f, i) => {
    let baseIdx = (f * 9) + i * 3
    // geometry.attributes.position[baseIdx], b: geometry.attributes.position[baseIdx + 1], c: geometry.attributes.position[baseIdx + 2]
  }
  for (let f = 0; f < numFaces; f++)
  {
    faceVertex(va, f, 0)
    faceVertex(vb, f, 1)
    faceVertex(vc, f, 2)
  }
}
