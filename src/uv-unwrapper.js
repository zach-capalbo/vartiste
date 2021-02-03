import {Pool} from './pool.js'
import {Util} from './util.js'
import {Undo} from './undo.js'

Util.registerComponentSystem('uv-unwrapper', {
  schema: {
    autoClear: {default: false},
    margin: {default: 0.00},
    autoDraw: {default: false},
    shapesVisible: {default: true},
  },
  init() {
    Pool.init(this)
    this.shapes = []
    this.shapeContainer = document.createElement('a-entity')
    this.el.append(this.shapeContainer)
    this.el.setAttribute('visible', 'true')
  },
  update(oldData) {
    this.shapeContainer.setAttribute('visible', this.data.shapesVisible)
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
    let tmpBox = this.pool('tmpBox', THREE.Box3)
    Compositor.mesh.geometry.computeBoundingBox()
    boundingBox.copy(Compositor.mesh.geometry.boundingBox)
    boundingBox.applyMatrix4(Compositor.mesh.matrixWorld)

    for (let mesh of Compositor.nonCanvasMeshes)
    {
      mesh.geometry.computeBoundingBox()
      tmpBox.copy(mesh.geometry.boundingBox)
      tmpBox.applyMatrix4(mesh.matrixWorld)
      boundingBox.union(tmpBox)
    }

    let center = this.pool('center', THREE.Vector3)
    boundingBox.getCenter(center)
    let cube = document.createElement('a-box')
    cube.setAttribute('position', center)
    cube.setAttribute('material', 'wireframe: true; shader: matcap')
    cube.setAttribute('axis-handles', '')
    let size = this.pool('boxSize', THREE.Vector3)
    boundingBox.getSize(size)
    cube.setAttribute('width', size.x)
    cube.setAttribute('height', size.y)
    cube.setAttribute('depth', size.z)
    cube.setAttribute('geometry', `width: ${size.x}; height: ${size.y}; depth: ${size.z}`)
    cube.classList.add('clickable')

    this.shapeContainer.append(cube)
    this.shapes.push(cube)
  },
  createCube() {
    let boundingBox = this.pool('boundingBox', THREE.Box3)
    let tmpBox = this.pool('tmpBox', THREE.Box3)
    Compositor.mesh.geometry.computeBoundingBox()
    boundingBox.copy(Compositor.mesh.geometry.boundingBox)
    boundingBox.applyMatrix4(Compositor.mesh.matrixWorld)

    for (let mesh of Compositor.nonCanvasMeshes)
    {
      mesh.geometry.computeBoundingBox()
      tmpBox.copy(mesh.geometry.boundingBox)
      tmpBox.applyMatrix4(mesh.matrixWorld)
      boundingBox.union(tmpBox)
    }

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
    cube.setAttribute('axis-handles', '')
    cube.classList.add('clickable')

    this.shapeContainer.append(cube)
    this.shapes.push(cube)
  },
  createCylinder() {
    let boundingSphere = this.pool('boundingSphere', THREE.Sphere)
    Compositor.mesh.geometry.computeBoundingBox()
    boundingSphere.copy(Compositor.mesh.geometry.boundingSphere)
    boundingSphere.applyMatrix4(Compositor.mesh.matrixWorld)

    let boundingBox = this.pool('boundingBox', THREE.Box3)
    boundingBox.copy(Compositor.mesh.geometry.boundingBox)
    boundingBox.applyMatrix4(Compositor.mesh.matrixWorld)

    let size = this.pool('size', THREE.Vector3)
    boundingBox.getSize(size)

    let sphere = document.createElement('a-cylinder')
    sphere.setAttribute('position', boundingSphere.center)
    sphere.setAttribute('radius', Math.max(size.x, size.z))
    sphere.setAttribute('height', size.y)
    sphere.setAttribute('material', 'wireframe: true; shader: matcap')
    sphere.setAttribute('axis-handles', '')
    sphere.classList.add('clickable')
    this.shapeContainer.append(sphere)

    let handle = document.createElement('a-entity')
    handle.setAttribute('axis-handle', 'axis: y')
    sphere.append(handle)

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
    sphere.setAttribute('axis-handles', '')
    sphere.classList.add('clickable')
    this.shapeContainer.append(sphere)

    this.shapes.push(sphere)
  },

  unwrapMesh(mesh)
  {
    let divisions = Util.divideCanvasRegions(this.shapes.length, {margin: this.data.margin})
    let geometry = mesh.geometry
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

    let count = geometry.attributes.uv.count * 2
    for (let i = 0; i < count; ++i)
    {
      if (isNaN(geometry.attributes.uv.array[i]))
      {
        geometry.attributes.uv.array[i] = 0
      }
    }

    mesh.geometry = geometry
    mesh.geometry.attributes.uv.needsUpdate = true
  },
  unwrap() {
    for (let mesh of Compositor.nonCanvasMeshes)
    {
      this.unwrapMesh(mesh)
    }

    if (this.data.autoDraw)
    {
      Compositor.component.addLayer(Compositor.component.layers.length)
      this.drawUVs()
    }
  },
  unwrapASphere(geometry, asphere, region)
  {
    let boundingSphere = this.pool('boundingSphere', THREE.Sphere)
    boundingSphere.copy(asphere.getObject3D('mesh').geometry.boundingSphere)
    boundingSphere.applyMatrix4(asphere.getObject3D('mesh').matrixWorld)
    let invMat = this.pool('invMat', THREE.Matrix4)
    invMat.copy(Compositor.mesh.matrixWorld).invert()
    boundingSphere.applyMatrix4(invMat)
    return this.applyProjection(this.sphereProject, geometry, boundingSphere, region)

  },
  unwrapACylinder(geometry, acylinder, region)
  {
    let boundingBox = this.pool('box', THREE.Box3)
    acylinder.getObject3D('mesh').geometry.computeBoundingBox()
    acylinder.getObject3D('mesh').updateMatrixWorld()
    Compositor.mesh.updateMatrixWorld()

    boundingBox.copy(acylinder.getObject3D('mesh').geometry.boundingBox)
    let invMat = this.pool('invMat', THREE.Matrix4)
    invMat.copy(acylinder.getObject3D('mesh').matrixWorld).invert()

    invMat.multiply(Compositor.mesh.matrixWorld)
    boundingBox.vertexTransform = invMat
    boundingBox.containsPoint = (point) => {
      let p = this.pool('p', THREE.Vector3)
      p.copy(point)
      p.applyMatrix4(boundingBox.vertexTransform)

      return THREE.Box3.prototype.containsPoint.call(boundingBox, p)
    }
    boundingBox.sphere = acylinder.getObject3D('mesh').geometry.boundingSphere
    return this.applyProjection(this.cylinderProject, geometry, boundingBox, region)
  },
  unwrapABox(geometry, abox, region)
  {
    let boundingBox = this.pool('box', THREE.Box3)
    abox.getObject3D('mesh').geometry.computeBoundingBox()
    abox.getObject3D('mesh').updateMatrixWorld()
    Compositor.mesh.updateMatrixWorld()

    boundingBox.copy(abox.getObject3D('mesh').geometry.boundingBox)
    let invMat = this.pool('invMat', THREE.Matrix4)
    invMat.copy(abox.getObject3D('mesh').matrixWorld).invert()


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
  cylinderProjectPoint(box, v, uv){
    v.applyMatrix4(box.vertexTransform)
    uv.y = THREE.Math.mapLinear(v.y, box.min.y, box.max.y, 0, 1)

    let spherical = new THREE.Spherical
    spherical.setFromCartesianCoords(v.x, v.y, v.z)

    uv.x =  (spherical.theta + Math.PI)/ Math.PI / 2
  },
  sphereProject(v0, v1, v2, uv0, uv1, uv2, sphere){
    this.sphereProjectPoint(sphere, v0, uv0)
    this.sphereProjectPoint(sphere, v1, uv1)
    this.sphereProjectPoint(sphere, v2, uv2)
  },
  cylinderProject(v0, v1, v2, uv0, uv1, uv2, box){
    this.cylinderProjectPoint(box, v0, uv0)
    this.cylinderProjectPoint(box, v1, uv1)
    this.cylinderProjectPoint(box, v2, uv2)
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

    let canWrap = !(region.min.x > 0 || region.max.x < 1 || region.min.y > 0 || region.max.y < 1)

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

      if (!canWrap) {
        region.clampPoint(uv0, uv0)
        region.clampPoint(uv1, uv1)
        region.clampPoint(uv2, uv2)
      }

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
  drawUVs() {
    let canvas = Compositor.drawableCanvas
    Undo.pushCanvas(canvas)

    let ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    for (let mesh of Compositor.nonCanvasMeshes)
    {
      let geometry = mesh.geometry
      geometry = geometry.toNonIndexed()

      let uvToPoint = (...args) => Compositor.el.components['draw-canvas'].uvToPoint(...args)

      let vertexUvs = geometry.attributes.uv
      let uv0 = new THREE.Vector2()
      let uv1 = new THREE.Vector2()
      let uv2 = new THREE.Vector2()

      let uv

      for (let vi = 0; vi < vertexUvs.count; vi += 3 )
      {
        uv0.fromBufferAttribute(vertexUvs, vi)
        uv1.fromBufferAttribute(vertexUvs, vi + 1)
        uv2.fromBufferAttribute(vertexUvs, vi + 2)

        ctx.beginPath()
        ctx.lineWidth = "0.5"
        ctx.strokeStyle = this.el.sceneEl.systems['paint-system'].data.color
        uv = uvToPoint(uv0, canvas, {useTransform: false})
        ctx.moveTo(uv.x, uv.y)

        uv = uvToPoint(uv1, canvas, {useTransform: false})
        ctx.lineTo(uv.x, uv.y)

        uv = uvToPoint(uv2, canvas, {useTransform: false})
        ctx.lineTo(uv.x, uv.y)

        uv = uvToPoint(uv0, canvas, {useTransform: false})
        ctx.lineTo(uv.x, uv.y)
        ctx.stroke()
      }
    }

    if (canvas.touch) canvas.touch()

    // ctx.restoreState()
  },
  async quickBoundingBoxUnwrap() {
    this.createBoundingBox()
    await Util.whenLoaded(this.shapes[0])
    this.unwrap()
    this.clearShapes()
  },
  applyLayerTransformToDrawnUVs() {
    let uv = new THREE.Vector2();
    let layer = Compositor.component.activeLayer
    let transform = Compositor.component.activeLayer.transform
    let canvas = Compositor.drawableCanvas
    let ctx = canvas.getContext('2d')
    let imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)

    let {translation, scale, rotation} = transform

    let transformMatrix = new THREE.Matrix3();
    let tmpMatrix = new THREE.Matrix3();

    transformMatrix.setUvTransform(translation.x / (layer.width * scale.x), translation.y / (layer.height * scale.y),
                                   scale.x, scale.y,
                                   rotation,
                                   0.5, 0.5)

    for (let geometry of Compositor.nonCanvasGeometries)
    {
      let attr = geometry.attributes.uv
      attr.applyMatrix3(transformMatrix);
      attr.needsUpdate = true
    }
  }
})

AFRAME.registerComponent('axis-handles', {
  schema: {
    x: {default: true},
    y: {default: true},
    z: {default: true},
  },
  init() {
    this.handles = {}
  },
  update(oldData) {
    console.log('updating handles', JSON.stringify(this.data))
    for (let axis of ['x', 'y', 'z'])
    {
      if (this.data[axis] && !this.handles[axis])
      {
        console.log("Creating for axis", axis)
        let handle = document.createElement('a-entity')
        handle.setAttribute('axis-handle-control', `axis: ${axis}`)
        this.el.append(handle)
        this.handles[axis] = handle
      }
      else if (!this.data[axis] && this.handles[axis])
      {
        this.handles[axis].remove()
        delete this.handles[axis]
      }
    }
  }
})

AFRAME.registerComponent('axis-handle-control', {
  schema: {
    axis: {type: 'string'}
  },
  events: {
    stateadded: function (e) {
      if (e.detail === 'grabbed')
      {
        this.startGrab()
      }
    },
    stateremoved: function(e) {
      if (e.detail === 'grabbed')
      {
        this.stopGrab()
      }
    }
  },
  init() {
    this.el.setAttribute('geometry', 'primitive: tetrahedron; radius: 0.04')
    this.el.setAttribute('grab-options', 'showHand: false')
    this.el.setAttribute('material', 'color: #9ae58b; shader: standard')
    this.el.classList.add('clickable')

    this.startPosition = new THREE.Vector3
  },
  update(oldData) {
    Util.whenLoaded(this.el.parentEl, () => {
      this.resetPosition()
    })
  },
  startGrab() {
    this.startPosition.copy(this.el.object3D.position)
  },
  stopGrab() {
    this.target.geometry.computeBoundingBox()
    let box = this.target.geometry.boundingBox
    let axis = this.data.axis
    let endPosition = this.el.object3D.position
    // let newScale = box.max[axis] / (this.startPosition[axis] - this.offset) * (endPosition[axis] - this.offset)
    let newScale = (endPosition[axis] - this.offset) / box.max[axis]

    this.target.scale[axis] = newScale
    if (axis !== 'x') this.el.object3D.position.x = 0
    if (axis !== 'y') this.el.object3D.position.y = 0
    if (axis !== 'z') this.el.object3D.position.z = 0
  },
  resetPosition() {
    this.target = this.el.parentEl.getObject3D('mesh')
    this.target.geometry.computeBoundingBox()
    let box = this.target.geometry.boundingBox
    this.offset = 0.08
    switch (this.data.axis)
    {
      case 'x': this.el.setAttribute('position', `${box.max.x + this.offset} 0 0`); break;
      case 'y': this.el.setAttribute('position', `0 ${box.max.y + this.offset} 0`); break;
      case 'z': this.el.setAttribute('position', `0 0 ${box.max.z + this.offset}`); break;
    }
  }
})
