import {Pool} from './pool.js'

AFRAME.registerSystem('uv-unwrapper', {
  init() {
    Pool.init(this)
    this.shapes = []
  },
  clearShapes() {
    for (let shape of this.shapes)
    {
      shape.remove()
    }
    this.shapes = []
  },
  createCube() {
    let boundingBox = this.pool('boundingBox', THREE.Box3)
    boundingBox.copy(Compositor.mesh.geometry.boundingBox)
    boundingBox.applyMatrix4(Compositor.mesh.matrixWorld)

    let cube = document.createElement('a-box')
    cube.setAttribute('position', boundingBox.getCenter())

  },
  createCylinder() {
    let boundingSphere = this.pool('boundingSphere', THREE.Sphere)
    boundingSphere.copy(Compositor.mesh.geometry.boundingSphere)
    boundingSphere.applyMatrix4(Compositor.mesh.matrixWorld)

    let boundingBox = this.pool('boundingBox', THREE.Box3)
    boundingBox.copy(Compositor.mesh.geometry.boundingBox)
    boundingBox.applyMatrix4(Compositor.mesh.matrixWorld)

    let sphere = document.createElement('a-cylinder')
    sphere.setAttribute('position', boundingSphere.center)
    sphere.setAttribute('radius', boundingSphere.radius)
    sphere.setAttribute('height', boundingBox.height)
    sphere.setAttribute('material', 'wireframe: true; shader: matcap')
    sphere.classList.add('clickable')
    this.el.append(sphere)

    this.shapes.push(sphere)
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

    this.shapes.push(sphere)
  },
  divideCanvasRegions() {
    // There's a math way to do this. I can't figure it out right now...
    let numberOfRegions = this.shapes.length
    let numberOfHorizontalCuts = 1
    let numberOfVerticalCuts = 1

    while (numberOfHorizontalCuts * numberOfVerticalCuts < numberOfRegions)
    {
      if (numberOfVerticalCuts > numberOfHorizontalCuts)
      {
        numberOfHorizontalCuts++
      }
      else
      {
        numberOfVerticalCuts++
      }
    }

    let boxes = []
    for (let y = 0; y < numberOfHorizontalCuts; ++y)
    {
      for (let x = 0; x < numberOfVerticalCuts; ++x)
      {
        boxes.push(new THREE.Box2(new THREE.Vector2(x / numberOfVerticalCuts, y / numberOfHorizontalCuts),
                                  new THREE.Vector2((x + 1) / numberOfVerticalCuts, (y + 1) / numberOfHorizontalCuts)))
      }
    }

    return boxes
  },
  unwrap()
  {
    let divisions = this.divideCanvasRegions()
    let geometry = Compositor.mesh.geometry
    let divisionIdx = 0
    for (let sphere of this.shapes)
    {
      geometry = this.unwrapASphere(geometry, sphere, divisions[divisionIdx++])
    }
    Compositor.mesh.geometry = geometry
  },
  unwrapASphere(geometry, asphere, region)
  {
    let boundingSphere = this.pool('boundingSphere', THREE.Sphere)
    boundingSphere.copy(asphere.getObject3D('mesh').geometry.boundingSphere)
    boundingSphere.applyMatrix4(asphere.getObject3D('mesh').matrixWorld)
    let invMat = this.pool('invMat', THREE.Matrix4)
    invMat.getInverse(Compositor.mesh.matrixWorld)
    boundingSphere.applyMatrix4(invMat)
    return this.applyProjection(this.sphereProject, geometry, boundingSphere, region)

  },
  unwrapACylinder(geometry, asphere, region)
  {
    let boundingSphere = this.pool('boundingSphere', THREE.Sphere)
    boundingSphere.copy(asphere.getObject3D('mesh').geometry.boundingSphere)
    boundingSphere.applyMatrix4(asphere.getObject3D('mesh').matrixWorld)
    let invMat = this.pool('invMat', THREE.Matrix4)
    invMat.getInverse(Compositor.mesh.matrixWorld)
    boundingSphere.applyMatrix4(invMat)
    return this.applyProjection(this.sphereProject, geometry, boundingSphere, region)

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
  cylinderProject(v, cylinder, uv){
    v.sub(cylinder.center)
    let cylindrical = new THREE.Cylindrical
    cylindrical.setFromCartesianCoords(v.x, v.y, v.z)
    uv.x =  (cylindrical.theta + Math.PI)/ Math.PI / 2
    uv.y = cylindrical.height / cylinder.height

  },
  applyProjection(projection, geometry, sphere, region) {
    if (typeof sphere === 'undefined')
    {
      sphere = geometry.boundingSphere
    }


    geometry = geometry.toNonIndexed()
    let coords = [];

    if (geometry.attributes.uv === undefined) {
      coords.length = 2 * geometry.attributes.position.array.length / 3;
      geometry.addAttribute('uv', new THREE.Float32BufferAttribute(coords, 2));
    }
    else
    {
      coords = geometry.attributes.uv.array
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

      if (!sphere.containsPoint(v0) || !sphere.containsPoint(v1) || !sphere.containsPoint(v2))
      {
        continue;
      }

      let log = false
      let reused = false

      if (coords[2 * idx0] > 0 || coords[2 * idx1] > 0 || coords[2 * idx2] > 0)
      {
        reused = true
      }

      projection(v0, sphere, uv0);
      projection(v1, sphere, uv1);
      projection(v2, sphere, uv2);

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

      uv0.x = THREE.Math.mapLinear(uv0.x, 0, 1, region.min.x, region.max.x)
      uv0.y = THREE.Math.mapLinear(uv0.y, 0, 1, region.min.y, region.max.y)

      uv1.x = THREE.Math.mapLinear(uv1.x, 0, 1, region.min.x, region.max.x)
      uv1.y = THREE.Math.mapLinear(uv1.y, 0, 1, region.min.y, region.max.y)

      uv2.x = THREE.Math.mapLinear(uv2.x, 0, 1, region.min.x, region.max.x)
      uv2.y = THREE.Math.mapLinear(uv2.y, 0, 1, region.min.y, region.max.y)

      coords[2 * idx0] = uv0.x;
      coords[2 * idx0 + 1] = uv0.y;
      coords[2 * idx1] = uv1.x;
      coords[2 * idx1 + 1] = uv1.y;
      coords[2 * idx2] = uv2.x;
      coords[2 * idx2 + 1] = uv2.y;
    }

    geometry.attributes.uv.array = new Float32Array(coords);
    return geometry

  },
})
