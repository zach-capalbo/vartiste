import {Pool} from './pool.js'
import {Undo} from './undo.js'
import {INTERSECTED, CONTAINED, NOT_INTERSECTED} from './framework/three-mesh-bvh.js'
import {THREED_MODES} from './layer-modes.js'
const Color = require('color')

export const MAP_FROM_FILENAME = {
  'aoMap': [/AmbientOcclusion(Map)?/i, /(\b|_)AO(map)?(\b|_)/i],
  'displacementMap': [
    /(\b|_)Height(\b|_)/i,
    /(\b|_)Disp(lacement)?(Map)?(\b|_)/i, ],
  'normalMap': [/(\b|_)norm?(al)?(map)?(gl|dx)?(\b|_)/i],
  'emissiveMap': [/(\b|_)emi(t|tion|ssive|ss|ssion)?(map)?(\b|_)/i],
  'metalnessMap': [/(\b|_)metal(ness|l?ic)?(map)?(\b|_)/i],
  'roughnessMap': [/(\b|_)rough(ness)?(map)?(\b|_)/i],
  'matcap': [/(\b|_)matcap(\b|_)/i]
}

function whenLoadedSingle(entity, fn) {
  if (entity.hasLoaded)
  {
    fn()
  }
  else
  {
    entity.addEventListener('loaded', fn)
  }
}

function whenLoadedAll(entities, fn) {
  let allLoaded = entities.map(() => false)
  for (let i = 0; i < entities.length; ++i)
  {
    let ii = i
    let entity = entities[ii]
    whenLoadedSingle(entity, () => {
      allLoaded[ii] = true
      if (allLoaded.every(t => t)) fn()
    })
  }
}

function awaitLoadingSingle(entity) {
  return new Promise((r, e) => whenLoadedSingle(entity, r))
}

async function awaitLoadingAll(entities) {
  for (let entity of entities)
  {
    await awaitLoadingSingle(entity)
  }
}

// General Utilities, accessible via `window.VARTISTE.Util`
class VARTISTEUtil {
  // Returns `{width, height}` as integers greater than 0
  validateSize({width, height}) {
    width = parseInt(width)
    height = parseInt(height)
    if (!(Number.isInteger(width) && width > 0)) {
      console.trace()
      throw new Error(`Invalid composition width ${width}`)
    }
    if (!(Number.isInteger(height) && height > 0)) {
      console.trace()
      throw new Error(`Invalid composition height ${height}`)
    }
    return {width, height}
  }

  // Executes function `fn` when `entity` has finished loading, or immediately
  // if it has already loaded. `entity` may be a single `a-entity` element, or
  // an array of `a-entity` elements. If `fn` is not provided, it will return a
  // `Promise` that will resolve when `entity` is loaded (or immediately if
  // `entity` is already loaded).
  whenLoaded(entity, fn) {
    if (Array.isArray(entity) && fn) return whenLoadedAll(entity, fn)
    if (Array.isArray(entity)) return awaitLoadingAll(entity)
    if (fn) return whenLoadedSingle(entity, fn)
    return awaitLoadingSingle(entity)
  }

  // Copies `matrix` into `obj`'s (a `THREE.Object3D`) `matrix`, and decomposes
  // it to `obj`'s position, rotation, and scale
  applyMatrix(matrix, obj) {
    obj.matrix.copy(matrix)
    matrix.decompose(obj.position, obj.rotation, obj.scale)
  }

  // If `destination` is provided, resizes `destination` to the same size as
  // `canvas` and copies `canvas` contents to `destination`. If `destination` is
  // not provided, it creates a new canvas with the same size and contents as
  // `canvas`.
  cloneCanvas(canvas, destination = undefined) {
    if (typeof destination === 'undefined') destination = document.createElement('canvas')
    destination.width = canvas.width
    destination.height = canvas.height
    destination.getContext('2d').drawImage(canvas, 0, 0)
    return destination
  }

  // Resizes canvas only if it is not already `width` x `height` (Changing a
  // canvas size sometimes clears the canvas)
  ensureSize(canvas, width, height) {
    if (canvas.width !== width || canvas.height !== height)
    {
      canvas.width = width
      canvas.height = height
    }
  }

  // Moves `obj` (`THREE.Object3D`) to the same spot as `target` (`THREE.Object3D`), accounting for the various matrix
  // transformations and parentages to get it there.
  positionObject3DAtTarget(obj, target, {scale, transformOffset, transformRoot} = {}) {
    if (typeof transformRoot === 'undefined') transformRoot = obj.parent

    target.updateMatrixWorld()
    let destMat = this.pool('dest', THREE.Matrix4)
    destMat.copy(target.matrixWorld)

    if (transformOffset) {
      let transformMat = this.pool('transformMat', THREE.Matrix4)
      transformMat.makeTranslation(transformOffset.x, transformOffset.y, transformOffset.z)
      destMat.multiply(transformMat)
    }

    if (scale) {
      let scaleVect = this.pool('scale', THREE.Vector3)
      scaleVect.setFromMatrixScale(destMat)
      scaleVect.set(scale.x / scaleVect.x, scale.y / scaleVect.y, scale.z / scaleVect.z)
      destMat.scale(scaleVect)
    }

    let invMat = this.pool('inv', THREE.Matrix4)

    transformRoot.updateMatrixWorld()
    invMat.copy(transformRoot.matrixWorld).invert()
    destMat.premultiply(invMat)

    Util.applyMatrix(destMat, obj)
  }

  keepingWorldPosition(object3D, fn) {
    let positioner = this.pool('positioner', THREE.Object3D)
    object3D.el.sceneEl.object3D.add(positioner);
    let wm = new THREE.Matrix4;
    wm.copy(object3D.matrixWorld);
    let res = fn();
    if (res && typeof res.then === 'function')
    {
      return res.then(() => {
        Util.applyMatrix(wm, positioner);
        Util.positionObject3DAtTarget(object3D, positioner)
      })
    }

    Util.applyMatrix(wm, positioner);
    Util.positionObject3DAtTarget(object3D, positioner)

    return res;
  }

  autoScaleViewer(rootObj, viewer)
  {
    let boundingBox = this.pool('boundingBox', THREE.Box3)
    let tmpBox = this.pool('tmpBox', THREE.Box3)
    let firstModel = rootObj.getObjectByProperty('type', 'Mesh') || rootObj.getObjectByProperty('type', 'SkinnedMesh')
    rootObj.updateMatrixWorld()

    firstModel.geometry.computeBoundingBox()
    boundingBox.copy(firstModel.geometry.boundingBox)
    firstModel.updateMatrixWorld()
    boundingBox.applyMatrix4(firstModel.matrixWorld)

    rootObj.traverse(m => {
      if (!m.geometry) return
      m.geometry.computeBoundingBox()
      m.updateMatrixWorld()
      tmpBox.copy(m.geometry.boundingBox)
      tmpBox.applyMatrix4(m.matrixWorld)
      boundingBox.union(tmpBox)
    })
    let maxDimension = Math.max(boundingBox.max.x - boundingBox.min.x,
                                boundingBox.max.y - boundingBox.min.y,
                                boundingBox.max.z - boundingBox.min.z)
    let targetScale = 0.5 / maxDimension
    viewer.setAttribute('scale', `${targetScale} ${targetScale} ${targetScale}`)

    boundingBox.getCenter(viewer.object3D.position)
    viewer.object3D.position.multiplyScalar(- targetScale)
    viewer.object3D.position.z = boundingBox.min.z * targetScale
  }

  // Returns the `THREE.Object3D` that contains the true world transformation
  // matrix for the camera. Works both on desktop and in VR
  cameraObject3D() {
    // return document.querySelector('#camera').object3D//.getObject3D('camera-matrix-helper')
    let scene = AFRAME.scenes[0]
    let camera = AFRAME.scenes[0].camera.el
    return scene.is('vr-mode') && document.querySelector('a-scene').hasWebXR ? camera.getObject3D('camera-matrix-helper') : camera.object3D
  }

  // Brings `initialEl` right in front of the camera
  flyToCamera(initialEl, {propogate = true, ...opts} = {}) {
    let target = this.cameraObject3D()

    let flyingEl = initialEl

    while (propogate && flyingEl['redirect-grab'])
    {
      flyingEl = flyingEl['redirect-grab']
    }

    this.positionObject3DAtTarget(flyingEl.object3D, target, {transformOffset: {x: 0, y: 0, z: -0.5}, ...opts})
  }

  // Registers a `ComponentSystem`. A `ComponentSystem` is a `Component` which
  // is automatically added to the `a-scene`, just like a system. It can be
  // accessed from both `sceneEl.systems` and `sceneEl.components`. The main
  // purpose of this is to have auto-registering systems which also have the
  // schema update events of components.
  registerComponentSystem(name, obj)
  {
    AFRAME.registerComponent(name, obj)
    AFRAME.registerSystem('_' + name, {
      init() {
        this.el.sceneEl.setAttribute(name, "")
        this.el.sceneEl.systems[name] = this.el.sceneEl.components[name]
      }
    })
  }

  // Executes `fn` on all ancestors of `el`
  traverseAncestors(el, fn)
  {
    el = el.parentEl
    while (el)
    {
      fn(el)
      el = el.parentEl
    }
  }

  // Executes `fn` on all ancestors of `el`, stopping and returning the ancestor if `fn` returns `true`
  traverseFindAncestor(el, fn)
  {
    el = el.parentEl
    while (el)
    {
      if (fn(el))
      {
        return el;
      }
      el = el.parentEl
    }
  }

  // Uses THREE.Object3D.traverse to find the first object where `fn` returns
  // `true`
  traverseFind(obj3D, fn, {visibleOnly = false} = {})
  {
    if (fn(obj3D)) return obj3D;

    for (let c of obj3D.children)
    {
      if (visibleOnly && !c.visible) continue
      let res = this.traverseFind(c, fn, {visibleOnly})
      if (res) return res
    }

    return;
  }

  // Uses THREE.Object3D.traverse to find all objects where `fn` returns
  // `true`
  traverseFindAll(obj3D, fn, {outputArray = [], visibleOnly = false} = {})
  {
    if (fn(obj3D)) outputArray.push(obj3D)

    for (let c of obj3D.children)
    {
      if (visibleOnly && !c.visible) continue
      this.traverseFindAll(c, fn, {outputArray, visibleOnly})
    }

    return outputArray;
  }

  traverseCondition(obj3D, condition, fn) {
    if (!condition(obj3D)) return;

    fn(obj3D)
    for (let c of obj3D.children)
    {
      this.traverseCondition(c, condition, fn)
    }
  }

  traverseNonUI(obj3D, fn) {
    return this.traverseCondition(obj3D, o => !o.userData || !o.userData.vartisteUI, fn)
  }

  traverseClone(obj3d, fn) {
    let newObj = obj3d.clone(false)
    for (let i in obj3d.children)
    {
      newObj.add(this.traverseClone(obj3d.children[i], fn))
    }
    fn(obj3d, newObj)
    return newObj
  }

  visibleWithAncestors(obj)
  {
    if (!obj.visible) return false
    while (obj.parent)
    {
      obj = obj.parent
      if (!obj.visible) return false
    }
    if (!obj.isScene) {
      return false
    }
    return true
  }

  disposeEl(el) {
    if (el.parentEl) {
      el.removeFromParent();
      el.remove()
    }
    el.destroy()
  }
  recursiveDispose(obj)
  {
    if (obj.object3D) { obj = obj.object3D; }
    obj.traverse(o => {
      if (o.material) {
        for (let mode of THREED_MODES)
        {
          if (o.material[mode] && o.material[mode].dispose) o.material[mode].dispose();
        }
        if (o.material.dispose) o.material.dispose()
      }
      if (o.geometry) o.geometry.dispose()
    })
  }

  // Uppercases the first letter of each word
  titleCase(str) {
    return str.replace(/\w\S*/g, t => t.charAt(0).toUpperCase() + t.substr(1))
  }

  unenumerable(obj, prop)
  {
    return
    let pname = "__" + prop
    let initVal = obj[prop]
    Object.defineProperty(obj, prop, {enumerable: false, get: () => obj[pname], set: (v) => obj[pname] = v})
    obj[pname] = initVal
  }

  // Makes it easier to see what's going on with `canvas` (either downloads or displays it)
  debugCanvas(canvas) {
    document.querySelector('a-scene').systems['settings-system'].download(canvas.toDataURL(), {extension: 'png', suffix: 'debug'}, "Debug Image")
  }

  divideCanvasRegions(numberOfRegions, {margin = 0} = {}) {
    // There's a math way to do this. I can't figure it out right now...
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

        newBox.expandByScalar(- margin)
        boxes.push(newBox)
      }
    }

    return boxes
  }

  uvWrapClamp(val) {
    val = val % 1.0
    //v = (v === 0 && val > 0) ? 1.0 : v
    //v = (v < 0) ?  1.0 - v : v
    return val
  }

  applyUVBox(box, geometry) {
    let attr = geometry.attributes.uv;

    if (attr.data)
    {
      for (let i = 0; i < attr.count; ++i)
      {
        attr.setXY(i,
          THREE.Math.mapLinear(attr.getX(i) % 1.00000000000001, 0, 1, box.min.x, box.max.x),
          THREE.Math.mapLinear(attr.getY(i) % 1.00000000000001, 0, 1, box.min.y, box.max.y))
      }
    }
    else
    {
      let indices = {has: function() { return true; }}
      if (geometry.index)
      {
        indices = new Set(geometry.index.array)
      }

      for (let i in geometry.attributes.uv.array) {
        if (!indices.has(Math.floor(i / 2))) continue;

        if (i %2 == 0) {
          attr.array[i] = THREE.Math.mapLinear(attr.array[i] % 1.00000000000001, 0, 1, box.min.x, box.max.x)
        }
        else
        {
          attr.array[i] = THREE.Math.mapLinear(attr.array[i] % 1.00000000000001, 0, 1, box.min.y, box.max.y)
        }
      }
    }

    attr.needsUpdate = true

    return geometry;
  }

  // Resolves all the manipulator grap redirections on `targetEl` and returns
  // the final element that should actually be grabbed when `targetEl` is
  // grabbed.
  resolveGrabRedirection(targetEl) {
    let target = targetEl
    for (let redirection = targetEl['redirect-grab']; redirection; redirection = target['redirect-grab'])
    {
      target = redirection
    }
    return target
  }

  deinterleaveAttributes(geometry) {
    for (let name in geometry.attributes)
    {
      let attr = geometry.attributes[name]
      if (!attr) continue
      if (!attr.isInterleavedBufferAttribute) continue
      let arr = []
      // arr.length = attr.count * attr.itemSize

      console.log(name, attr)

      for (let i = 0; i < attr.count; ++i)
      {
        arr.push(attr.getX(i))
        if (attr.itemSize >= 2) arr.push(attr.getY(i))
        if (attr.itemSize >= 3) arr.push(attr.getZ(i))
        if (attr.itemSize >= 4) arr.push(attr.getW(i))
      }

      geometry.setAttribute(name, new THREE.Float32BufferAttribute(arr, attr.itemSize))
    }
  }

  // Linearly interpolates two transformation matrices
  interpTransformMatrices(alpha, start, end, {result} = {})
  {
    if (!result) result = new THREE.Matrix4
    let startPose = this.pool('startPose', THREE.Vector3)
    let endPose = this.pool('endPose', THREE.Vector3)

    let startQuat = this.pool('startQuat', THREE.Quaternion)
    let endQuat = this.pool('endQuat', THREE.Quaternion)

    let startScale = this.pool('startScale', THREE.Vector3)
    let endScale = this.pool('endScale', THREE.Vector3)

    start.decompose(startPose, startQuat, startScale)
    end.decompose(endPose, endQuat, endScale)
    startPose.lerp(endPose, alpha)
    startQuat.slerp(endQuat, alpha)
    startScale.lerp(endScale, alpha)
    result.compose(startPose, startQuat, startScale)
    return result
  }

  // Returns true if `canvas` has no pixels with an alpha less than 1.0
  isCanvasFullyOpaque(canvas, threshold = 255) {
    let ctx = canvas.getContext('2d')
    let data = ctx.getImageData(0, 0, canvas.width, canvas.height)
    for (let i = 3; i < data.data.length; i += 4)
    {
      if (data.data[i] < threshold) return false
    }

    return true
  }

  isCanvasFullyTransparent(canvas) {
    let ctx = canvas.getContext('2d')
    let data = ctx.getImageData(0, 0, canvas.width, canvas.height)
    for (let i = 3; i < data.data.length; i += 4)
    {
      if (data.data[i] > 0) return false
    }

    return true
  }

  autoCropBounds(canvas) {
    let ctx = canvas.getContext('2d')
    let data = ctx.getImageData(0, 0, canvas.width, canvas.height)
    let box = new THREE.Box2
    let pixel = new THREE.Box2
    for (let y = 0; y < canvas.height; ++y)
    {
      for (let x = 0; x < canvas.width; ++x)
      {
        if (data.data[(y*canvas.width + x) * 4 + 3] > 0) {
          pixel.min.set(x,y)
          pixel.max.set(x+1,y+1)
          box.union(pixel)
        }
      }
    }

    return box
  }

  autoCropCanvas(canvas) {
    let bounds = this.autoCropBounds(canvas)
    let dest = document.createElement('canvas')
    let size = new THREE.Vector2
    bounds.getSize(size)
    dest.width = size.x
    dest.height = size.y
    dest.getContext('2d').drawImage(canvas, bounds.min.x, bounds.min.y, size.x, size.y, 0, 0, size.x, size.y)
    return dest
  }

  callLater(fn = function(){}) {
    return new Promise((r, e) => {
      window.setTimeout(() => {
        fn()
        r()
      }, 1)
    })
  }

  mapFromFilename(filename) {
    for (let map in MAP_FROM_FILENAME)
    {
      if (MAP_FROM_FILENAME[map].some(exp => exp.test(filename)))
      {
        return map
      }
    }
  }

  fillDefaultCanvasForMap(canvas, map, {replace = false} = {})
  {
    let shouldFill = false
    let ctx = canvas.getContext('2d')
    switch (map)
    {
      case 'normalMap':
        ctx.fillStyle = 'rgb(128, 128, 255)'
        shouldFill = true
        break;
      case 'metalnessMap':
        ctx.fillStyle = 'rgb(0, 0, 0)'
        shouldFill = true;
        break;
      case 'roughnessMap':
        ctx.fillStyle = 'rgb(255, 255, 255)'
        shouldFill = true;
        break;
      case 'bumpMap':
        ctx.fillStyle = 'rgb(0, 0, 0)'
        shouldFill = true;
        break;
      case 'aoMap':
        ctx.fillStyle = 'rgb(255, 255, 255)'
        shouldFill = true;
        break;
      case 'emissiveMap':
        ctx.fillStyle = 'rgb(0, 0, 0)'
        shouldFill = true;
        break;
      default:
        console.warn("Can't fill unknown map", map)
        break;
      }

      if (shouldFill)
      {
        Undo.pushCanvas(canvas)
        ctx.globalCompositeOperation = replace ? 'source-over' : 'destination-over'
        ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height)
        ctx.globalCompositeOperation = 'source-over'
      }

      return shouldFill
  }

  whenComponentInitialized(el, component, fn) {
    if (el && el.components[component] && el.components[component].initialized) {
      return Promise.resolve(fn ? fn() : undefined)
    }

    return new Promise((r, e) => {
      if (el && el.components[component] && el.components[component].initialized) {
        return Promise.resolve(fn ? fn() : undefined)
      }

      let listener = (e) => {
        if (e.detail.name === component) {
          el.removeEventListener('componentinitialized', listener);
          if (fn) fn();
          r();
        }
      };
      el.addEventListener('componentinitialized', listener)
    })
  }

  recursiveBoundingBox(rootObj, {box = undefined, onlyVisible = true, includeUI = true, world = true} = {})
  {
    let boundingBox = box || this.pool('boundingBox', THREE.Box3)
    let tmpBox = this.pool('tmpBox', THREE.Box3)
    let firstModel = rootObj.getObjectByProperty('type', 'Mesh') || rootObj.getObjectByProperty('type', 'SkinnedMesh')

    if (!firstModel) return boundingBox.makeEmpty();

    rootObj.updateMatrixWorld(true, true)

    firstModel.geometry.computeBoundingBox()
    boundingBox.copy(firstModel.geometry.boundingBox)
    firstModel.updateMatrixWorld()
    boundingBox.applyMatrix4(firstModel.matrixWorld)

    let skipSet = new Set()
    rootObj.traverse(m => {
      if (onlyVisible && !m.visible) return;
      if (!includeUI)
      {
        if (skipSet.has(m)) return;

        if (m.userData && m.userData.vartisteUI) {
          m.traverse(mm => skipSet.add(mm))
        }
        return
      }

      if (!m.geometry) return
      m.geometry.computeBoundingBox()
      m.updateMatrixWorld()
      tmpBox.copy(m.geometry.boundingBox)
      tmpBox.applyMatrix4(m.matrixWorld)

      // Hidden Icon buttons
      if (tmpBox.min.y < -9999) return;

      boundingBox.union(tmpBox)
    })

    if (!world)
    {
      let invMat = this.pool('invMat', THREE.Matrix4)
      invMat.copy(rootObj.matrixWorld).invert()
      boundingBox.applyMatrix4(invMat)
    }

    return boundingBox
  }

  emitsEvents(component) {
    component.emitDetails = AFRAME.utils.clone(Object.getPrototypeOf(component).emits)
    const debugEmitDocs = false;
    if (debugEmitDocs)
    {
      let oldEmit = component.emit
      component.emit = function(event, ...args) {
        if (!(event in component.emitDetails)) {
          console.warn("Undocumented event emitted:", event)
          console.trace()
        }
        oldEmit.call(this, ...args)
      }
    }
  }
  async busy(fn, opts) {
    let scene = AFRAME.scenes[0]
    let busy = scene.systems['busy-indicator'].busy(opts)
    try {
      await fn()
      busy.done()
    } catch (e) {
      busy.error(e)
      throw e
    }
  }

  busify(opts, fn, self) {
    let scene = AFRAME.scenes[0]
    return async function(...args) {
      let busy = scene.systems['busy-indicator'].busy(opts)
      try {
        await fn.call(self, ...args)
        busy.done()
      } catch (e) {
        busy.error(e)
        throw e
      }
    }
  }

  async delay(t) { return new Promise(r => setTimeout(r, t)); }

  isLowPower() {
    let lowPower = AFRAME.utils.device.isMobileVR();
    let params = new URLSearchParams(document.location.search)
    if (params.get("lowPower"))
    {
      lowPower = true;
    }

    if (params.get("highPower"))
    {
      lowPower = false;
    }
    return lowPower;
  }

  meshPointsInContainerMesh(mesh, container) {
    if (mesh.type !== 'Mesh' || container.type !== 'Mesh') {
      console.warn("meshPointsInContainerMesh only works on meshes!", mesh, container)
    }
    const inverseMatrix = new THREE.Matrix4();
    inverseMatrix.copy( mesh.matrixWorld ).invert();

    container.geometry.computeBoundingSphere();
    const sphere = new THREE.Sphere();
    container.getWorldPosition(sphere.center).applyMatrix4( inverseMatrix );
    sphere.radius = container.geometry.boundingSphere.radius;

    let meshToContainer = new THREE.Matrix4;
    meshToContainer.copy(container.matrixWorld).invert();
    meshToContainer.premultiply(mesh.matrixWorld);

    let bvh = mesh.geometry.computeBoundsTree();
    let containerBvh = container.geometry.computeBoundsTree();

    let indices = []

    let tempVec = new THREE.Vector3();

    let index = mesh.geometry.index.array

    let raycaster = new THREE.Raycaster;
    raycaster.ray.direction.set(1, 0.1, 0);

    let oldSided = container.material.side;

    container.material.side = THREE.DoubleSide;

    bvh.shapecast(mesh, {
      intersectsBounds: box => {
        // console.log("Checking box", box, sphere)
        const intersects = sphere.intersectsBox( box );
        const { min, max } = box;
        if ( intersects ) {
          for ( let x = 0; x <= 1; x ++ ) {
            for ( let y = 0; y <= 1; y ++ ) {
              for ( let z = 0; z <= 1; z ++ ) {
                tempVec.set(
                  x === 0 ? min.x : max.x,
                  y === 0 ? min.y : max.y,
                  z === 0 ? min.z : max.z
                );
                if ( ! sphere.containsPoint( tempVec ) ) {
                  return INTERSECTED;
                }
              }
            }
          }
          return CONTAINED;
        }

        return intersects ? INTERSECTED : NOT_INTERSECTED;
      },

      intersectsTriangle: ( tri, i, contained ) => {
        if ( contained || tri.intersectsSphere( sphere ) ) {
          const i3 = 3 * i;
          // tri.a.applyMatrix4(meshToContainer)
          // tri.b.applyMatrix4(meshToContainer)
          // tri.c.applyMatrix4(meshToContainer)
          raycaster.ray.origin.copy(tri.a)
          mesh.localToWorld(raycaster.ray.origin)
          let intersections = [];

          raycaster.intersectObject(container, false, intersections)

          if (intersections.length % 2 == 1)
          {
            indices.push( index[i3] )
          }

          intersections.length = 0
          raycaster.ray.origin.copy(tri.b)
          mesh.localToWorld(raycaster.ray.origin)
          raycaster.intersectObject(container, false, intersections)

          if (intersections.length % 2 == 1)
          {
            indices.push( index[i3 + 1] )
          }
          intersections.length = 0
          raycaster.ray.origin.copy(tri.c)
          mesh.localToWorld(raycaster.ray.origin)
          raycaster.intersectObject(container, false, intersections)

          if (intersections.length % 2 == 1)
          {
            indices.push( index[i3 + 2] )
          }
        }
        return false;
      }
    } );

    container.material.side = oldSided;

    return indices;
  }

  meshesIntersect(meshA, meshB, includeContained = false)
  {
    let bvh;

    if (meshA.geometry.attributes.position.itemSize !== 3) return;
    if (meshB.geometry.attributes.position.itemSize !== 3) return;

    bvh = meshA.geometry.computeBoundsTree()
    meshB.geometry.computeBoundsTree()

    let matrix = this.pool('matrix', THREE.Matrix4)

    meshA.updateMatrixWorld()
    meshB.updateMatrixWorld()
    matrix.copy(meshA.matrixWorld)
    matrix.invert()
    matrix.multiply(meshB.matrixWorld)

    if (bvh.intersectsGeometry(meshA, meshB.geometry, matrix)) return true
    if (!includeContained) return false

    let tmpBox = this.pool('tmpBox', THREE.Box3)
    tmpBox.copy(meshB.geometry.boundingBox)
    tmpBox.applyMatrix4(matrix)

    if (!tmpBox.intersectsBox(meshA.geometry.boundingBox)) return false

    // TODO Check boundng box
    let intersections = []
    let raycaster = this.pool('raycaster', THREE.Raycaster);
    raycaster.ray.direction.set(1, 0.1, 0);
    let oldSided = meshA.material.side;
    meshA.material.side = THREE.DoubleSide;
    raycaster.ray.origin.fromBufferAttribute(meshB.geometry.attributes.position, 0)
    meshB.localToWorld(raycaster.ray.origin)
    raycaster.intersectObject(meshA, false, intersections)
    meshA.material.side = oldSided
    if (intersections.length % 2 == 1) return true
    intersections.length = 0
    oldSided = meshB.material.side;
    meshB.material.side = THREE.DoubleSide;
    raycaster.ray.origin.fromBufferAttribute(meshA.geometry.attributes.position, 0)
    meshA.localToWorld(raycaster.ray.origin)
    raycaster.intersectObject(meshB, false, intersections)
    meshB.material.side = oldSided
    if (intersections.length % 2 == 1) return true

    return false
  }

  objectsIntersect(objA, objB, {visibleOnly = true, intersectionInfo, includeContained = true} = {})
  {
    if (objA.object3D) objA = objA.object3D;
    if (objB.object3D) objB = objB.object3D;

    let intersected = false
    objA.traverseVisible(oA => {
      if (intersected) return
      if (!oA.isMesh) return;
      if (visibleOnly && oA.el && oA.el.className.includes("raycast-invisible")) return
      if (visibleOnly && !oA.visible) return

      objB.traverseVisible(oB => {
        if (intersected) return
        if (!oB.isMesh) return;
        if (visibleOnly && !oB.visible) return
        if (visibleOnly && oB.el && oB.el.className.includes("raycast-invisible")) return
        if (this.meshesIntersect(oA, oB, includeContained))
        {
          if (intersectionInfo)
          {
            intersectionInfo.objectA = oA
            intersectionInfo.objectB = oB
          }
          intersected = true
        }
      })
    })

    return intersected
  }
  translate(str) {
    if (!this.el.sceneEl.systems['ui-translation']) return str
    return this.el.sceneEl.systems['ui-translation'].translate(str)
  }
}

const Util = new VARTISTEUtil();

Pool.init(Util)

window.VARTISTE = {Util, Color, Undo}

AFRAME.registerSystem('vartiste-util', {
  init() {
    Util.el = this.el.sceneEl
  }
})

export {Util}
