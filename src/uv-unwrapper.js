import {Pool} from './pool.js'

AFRAME.registerSystem('uv-unwrapper', {
  init() {
    Pool.init(this)
    this.spheres = []
  },
  createCube() {

  },
  createSphere() {
    let boundingSphere = this.pool('boundingSphere', THREE.Sphere)
    boundingSphere.copy(Compositor.mesh.geometry.boundingSphere)
    boundingSphere.applyMatrix4(Compositor.mesh.matrixWorld)

    let sphere = document.createElement('a-sphere')
    sphere.setAttribute('position', boundingSphere.center)
    sphere.setAttribute('radius', boundingSphere.radius)
    sphere.setAttribute('material', 'wireframe: true; shader: matcap')
    sphere.classList.add('clickable')
    this.el.append(sphere)

    this.spheres.push(sphere)
  },
  unwrap()
  {
    let geometry = Compositor.mesh.geometry
    for (let sphere of this.spheres)
    {
      geometry = this.unwrapASphere(geometry, sphere)
    }
    Compositor.mesh.geometry = geometry
  },
  unwrapASphere(geometry, asphere)
  {
    let boundingSphere = this.pool('boundingSphere', THREE.Sphere)
    boundingSphere.copy(asphere.getObject3D('mesh').geometry.boundingSphere)
    boundingSphere.applyMatrix4(asphere.getObject3D('mesh').matrixWorld)
    let invMat = this.pool('invMat', THREE.Matrix4)
    invMat.getInverse(Compositor.mesh.matrixWorld)
    boundingSphere.applyMatrix4(invMat)
    return this.applySphere(geometry, boundingSphere)

  },
  sphereProject(v, sphere, uv){
    v.sub(sphere.center)
    let spherical = new THREE.Spherical
    spherical.setFromCartesianCoords(v.x, v.y, v.z)

    // Need to check against other faces for angle wrap around
    uv.x =  (spherical.theta + Math.PI)/ Math.PI / 2
    uv.y = (spherical.phi) / Math.PI

    // console.log(v, spherical, uv)
  },
  applySphere(geometry, sphere) {
    if (typeof sphere === 'undefined')
    {
      sphere = geometry.boundingSphere
    }

    geometry.removeAttribute('uv');
    geometry = geometry.toNonIndexed()
    let coords = [];
    coords.length = 2 * geometry.attributes.position.array.length / 3;
    if (geometry.attributes.uv === undefined) {
        geometry.addAttribute('uv', new THREE.Float32BufferAttribute(coords, 2));
    }

    let v0 = new THREE.Vector3
    let v1 = new THREE.Vector3
    let v2 = new THREE.Vector3
    let uv0 = new THREE.Vector2
    let uv1 = new THREE.Vector2
    let uv2 = new THREE.Vector2

    // for (let vi = 0; vi < geometry.index.array.length; vi += 3) {
    //   let idx0 = geometry.index.array[vi];
    //   let idx1 = geometry.index.array[vi + 1];
    //   let idx2 = geometry.index.array[vi + 2];

    for (let vi = 0; vi < geometry.attributes.position.count; vi+=3) {
      let idx0 = vi
      let idx1 = vi + 1
      let idx2 = vi + 2

      v0.fromBufferAttribute(geometry.attributes.position, idx0);
      v1.fromBufferAttribute(geometry.attributes.position, idx1)
      v2.fromBufferAttribute(geometry.attributes.position, idx2)

      let log = false
      let reused = false

      if (coords[2 * idx0] > 0 || coords[2 * idx1] > 0 || coords[2 * idx2] > 0)
      {
        reused = true
      }

      this.sphereProject(v0, sphere, uv0);

      this.sphereProject(v1, sphere, uv1);

      this.sphereProject(v2, sphere, uv2);

      // Handle wrap around
      let rightmost = uv0
      if (uv1.x > rightmost.x) rightmost = uv1
      if (uv2.x > rightmost.x) rightmost = uv2

      if (uv0.x + 1 - rightmost.x < rightmost.x - uv0.x)
      {
        uv0.x += 1.0;
      }
      if (uv1.x + 1 - rightmost.x < rightmost.x - uv1.x) {
        uv1.x += 1.0;
      }
      if (uv2.x + 1 - rightmost.x < rightmost.x - uv2.x) {
        uv2.x += 1.0;
      }

      if (reused)
      {
        if (uv0.x !== coords[2 * idx0])
        {
          log = true
        }
        if (uv1.x !== coords[2 * idx1])
        {
          log = true
        }
        if (uv2.x !== coords[2 * idx2])
        {
          log = true
        }
      }

      if (log) {
        console.log(uv0, uv1, uv2, rightmost, coords[2 * idx0], coords[2 * idx1], coords[2 * idx2])
      }

      if (!coords[2 * idx0]) {
        coords[2 * idx0] = uv0.x;
        coords[2 * idx0 + 1] = uv0.y;
      }

      if (!coords[2 * idx1]) {
        coords[2 * idx1] = uv1.x;
        coords[2 * idx1 + 1] = uv1.y;
      }

      if (!coords[2 * idx2]) {
        coords[2 * idx2] = uv2.x;
        coords[2 * idx2 + 1] = uv2.y;
      }

      // if (coords[2 * idx0] < 0.2 &&
      //   (coords[2 * idx1] > 0.5 || coords[2 * idx2] > 0.5))
      // {
      //   coords[2 * idx0] = 1.0
      // }
      //
      // if (coords[2 * idx1] < 0.2 &&
      //   (coords[2 * idx0] > 0.5 || coords[2 * idx2] > 0.5))
      // {
      //   coords[2 * idx1] = 1.0
      // }
      //
      // if (coords[2 * idx2] < 0.2 &&
      //   (coords[2 * idx1] > 0.5 || coords[2 * idx0] > 0.5))
      // {
      //   coords[2 * idx2] = 1.0
      // }

    }

    geometry.attributes.uv.array = new Float32Array(coords);
    return geometry

  },
})
