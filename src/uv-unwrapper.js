import {Pool} from './pool.js'
import {Util} from './util.js'

Util.registerComponentSystem('uv-unwrapper', {
  schema: {
    autoClear: {default: false},
    margin: {default: 0.02},
  },
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
  createBoundingBox() {
    let boundingBox = this.pool('boundingBox', THREE.Box3)
    boundingBox.copy(Compositor.mesh.geometry.boundingBox)
    boundingBox.applyMatrix4(Compositor.mesh.matrixWorld)

    let center = this.pool('center', THREE.Vector3)
    boundingBox.getCenter(center)
    let cube = document.createElement('a-box')
    cube.setAttribute('position', center)
    cube.setAttribute('material', 'wireframe: true; shader: matcap')
    let size = this.pool('boxSize', THREE.Vector3)
    boundingBox.getSize(size)
    cube.setAttribute('width', size.x)
    cube.setAttribute('height', size.y)
    cube.setAttribute('depth', size.z)
    cube.classList.add('clickable')

    this.el.append(cube)
    this.shapes.push(cube)
  },
  createCube() {
    let boundingBox = this.pool('boundingBox', THREE.Box3)
    boundingBox.copy(Compositor.mesh.geometry.boundingBox)
    boundingBox.applyMatrix4(Compositor.mesh.matrixWorld)

    let center = this.pool('center', THREE.Vector3)
    boundingBox.getCenter(center)
    let cube = document.createElement('a-box')
    cube.setAttribute('position', center)
    cube.setAttribute('material', 'wireframe: true; shader: matcap')
    let size = this.pool('boxSize', THREE.Vector3)
    let side = (size.x + size.y + size.z) / 3
    boundingBox.getSize(size)
    cube.setAttribute('width', side)
    cube.setAttribute('height', side)
    cube.setAttribute('depth', side)
    cube.classList.add('clickable')

    this.el.append(cube)
    this.shapes.push(cube)
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
        let newBox = new THREE.Box2(new THREE.Vector2(x / numberOfVerticalCuts, y / numberOfHorizontalCuts),
                                  new THREE.Vector2((x + 1) / numberOfVerticalCuts, (y + 1) / numberOfHorizontalCuts))

        newBox.expandByScalar(- this.data.margin)
        boxes.push(newBox)
      }
    }

    return boxes
  },
  unwrap()
  {
    let divisions = this.divideCanvasRegions()
    let geometry = Compositor.mesh.geometry
    let divisionIdx = 0

    geometry = geometry.toNonIndexed()

    if (this.data.autoClear)
    {
      geometry.removeAttribute('uv')
    }

    if (geometry.attributes.uv === undefined) {
      let coords = [];
      coords.length = 2 * geometry.attributes.position.array.length / 3;
      geometry.addAttribute('uv', new THREE.Float32BufferAttribute(coords, 2));
    }

    for (let shape of this.shapes)
    {
      switch (shape.nodeName)
      {
        case 'A-SPHERE': this.unwrapASphere(geometry, shape, divisions[divisionIdx++]); break;
        case 'A-CYLINDER': this.unwrapACylinder(geometry, shape, divisions[divisionIdx++]); break;
        case 'A-BOX': this.unwrapABox(geometry, shape, divisions[divisionIdx++]); break;
      }
    }

    Compositor.mesh.geometry = geometry
    Compositor.mesh.geometry.attributes.uv.needsUpdate = true
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
  unwrapABox(geometry, abox, region)
  {
    let boundingBox = this.pool('box', THREE.Box3)
    abox.getObject3D('mesh').geometry.computeBoundingBox()
    abox.object3D.updateMatrixWorld()
    Compositor.mesh.updateMatrixWorld()

    boundingBox.copy(abox.getObject3D('mesh').geometry.boundingBox)
    let invMat = this.pool('invMat', THREE.Matrix4)
    invMat.getInverse(abox.object3D.matrixWorld)


    invMat.multiply(Compositor.mesh.matrixWorld)
    boundingBox.vertexTransform = invMat
    boundingBox.containsPoint = (point) => {
      let p = this.pool('p', THREE.Vector3)
      p.copy(point)
      p.applyMatrix4(boundingBox.vertexTransform)
      
      return THREE.Box3.prototype.containsPoint.call(boundingBox, p)
    }
    return this.applyProjection(this.boxProject, geometry, boundingBox, region)
  },
  sphereProjectPoint(sphere, v, uv){
    v.sub(sphere.center)
    let spherical = new THREE.Spherical
    spherical.setFromCartesianCoords(v.x, v.y, v.z)

    // Need to check against other faces for angle wrap around
    uv.x =  (spherical.theta + Math.PI)/ Math.PI / 2
    uv.y = (spherical.phi) / Math.PI

    // console.log(v, spherical, uv)
  },
  cylinderProjectPoint(cylinder, v, uv){
    v.sub(cylinder.center)
    let cylindrical = new THREE.Cylindrical
    cylindrical.setFromCartesianCoords(v.x, v.y, v.z)
    uv.x =  (cylindrical.theta + Math.PI)/ Math.PI / 2
    uv.y = cylindrical.height / cylinder.height
  },
  sphereProject(v0, v1, v2, uv0, uv1, uv2, sphere){
    this.sphereProjectPoint(sphere, v0, uv0)
    this.sphereProjectPoint(sphere, v1, uv1)
    this.sphereProjectPoint(sphere, v2, uv2)
  },
  cylinderProject(v0, v1, v2, uv0, uv1, uv2, cylinder){
    this.cylinderProjectPoint(cylinder, v0, uv0)
    this.cylinderProjectPoint(cylinder, v1, uv1)
    this.cylinderProjectPoint(cylinder, v2, uv2)
  },
  boxProject(v0, v1, v2, uv0, uv1, uv2, box) {
    v0.applyMatrix4(box.vertexTransform)
    v1.applyMatrix4(box.vertexTransform)
    v2.applyMatrix4(box.vertexTransform)

    let normal = this.pool('normal', THREE.Vector3)
    normal.crossVectors(v1.clone().sub(v0), v1.clone().sub(v2)).normalize()

    let abs = this.pool('abs', THREE.Vector3)

    abs.x = Math.abs(normal.x)
    abs.y = Math.abs(normal.y)
    abs.z = Math.abs(normal.z)

    let maxComponent = Math.max(abs.x, abs.y, abs.z)

    let param = this.pool('param', THREE.Vector3)

    let quadrant = this.pool('quadrant', THREE.Box2)

    if (maxComponent === abs.x)
    {
      box.getParameter(v0, param)
      uv0.x = param.z
      uv0.y = param.y

      box.getParameter(v1, param)
      uv1.x = param.z
      uv1.y = param.y

      box.getParameter(v2, param)
      uv2.x = param.z
      uv2.y = param.y

      quadrant.min.x = 0
      quadrant.max.x = 1.0 / 3.0
      let yOffset = normal.x > 0 ? 0 : 0.5
      quadrant.min.y = 0 + yOffset
      quadrant.max.y = 0.5 + yOffset
    }
    else if (maxComponent === abs.z)
    {
      box.getParameter(v0, param)
      uv0.x = param.x
      uv0.y = param.y

      box.getParameter(v1, param)
      uv1.x = param.x
      uv1.y = param.y

      box.getParameter(v2, param)
      uv2.x = param.x
      uv2.y = param.y

      quadrant.min.x = 1.0 / 3.0
      quadrant.max.x = 2.0 / 3.0
      let yOffset = normal.z > 0 ? 0 : 0.5
      quadrant.min.y = 0 + yOffset
      quadrant.max.y = 0.5 + yOffset
    }
    else
    {
      box.getParameter(v0, param)
      uv0.x = param.x
      uv0.y = param.z

      box.getParameter(v1, param)
      uv1.x = param.x
      uv1.y = param.z

      box.getParameter(v2, param)
      uv2.x = param.x
      uv2.y = param.z

      quadrant.min.x = 2.0 / 3.0
      quadrant.max.x = 1.0
      let yOffset = normal.y > 0 ? 0 : 0.5
      quadrant.min.y = 0 + yOffset
      quadrant.max.y = 0.5 + yOffset
    }

    quadrant.expandByScalar(- this.data.margin)

    uv0.x = THREE.Math.mapLinear(uv0.x, 0, 1, quadrant.min.x, quadrant.max.x)
    uv0.y = THREE.Math.mapLinear(uv0.y, 0, 1, quadrant.min.y, quadrant.max.y)

    uv1.x = THREE.Math.mapLinear(uv1.x, 0, 1, quadrant.min.x, quadrant.max.x)
    uv1.y = THREE.Math.mapLinear(uv1.y, 0, 1, quadrant.min.y, quadrant.max.y)

    uv2.x = THREE.Math.mapLinear(uv2.x, 0, 1, quadrant.min.x, quadrant.max.x)
    uv2.y = THREE.Math.mapLinear(uv2.y, 0, 1, quadrant.min.y, quadrant.max.y)
  },
  applyProjection(projection, geometry, shape, region) {
    if (typeof shape === 'undefined')
    {
      shape = geometry.boundingSphere
    }

    let coords = geometry.attributes.uv.array

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

      if (!shape.containsPoint(v0) || !shape.containsPoint(v1) || !shape.containsPoint(v2))
      {

        continue;
      }

      let log = false
      let reused = false

      if (coords[2 * idx0] > 0 || coords[2 * idx1] > 0 || coords[2 * idx2] > 0)
      {
        reused = true
      }

      projection.call(this, v0, v1, v2, uv0, uv1, uv2, shape)

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

    // geometry.attributes.uv.array = new Float32Array(coords);
    return geometry

  },
})
