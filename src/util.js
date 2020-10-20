import {Pool} from './pool.js'

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
  return new Promise((e,r) => whenLoadedSingle(entity, r))
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
    invMat.getInverse(transformRoot.matrixWorld)
    destMat.premultiply(invMat)

    Util.applyMatrix(destMat, obj)
  }

  // Returns the `THREE.Object3D` that contains the true world transformation
  // matrix for the camera. Works both on desktop and in VR
  cameraObject3D() {
     return document.querySelector('a-scene').is('vr-mode') && document.querySelector('a-scene').hasWebXR ? document.querySelector('#camera').getObject3D('camera-matrix-helper') : document.querySelector('#camera').object3D
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
}

const Util = new VARTISTEUtil();

Pool.init(Util)

window.VARTISTE = {Util}

export {Util}
