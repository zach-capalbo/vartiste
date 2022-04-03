import {Util} from './util.js'
import {UndoStack} from './undo.js'
import {base64ArrayBuffer} from './framework/base64ArrayBuffer.js'
import './framework/GLTFExporter.js'
import {CanvasShaderProcessor} from './canvas-shader-processor.js'
import {THREED_MODES} from './layer-modes.js'
import shortid from 'shortid'

// Contains utilities for transforming materials and textures. Singleton
// accessible via VARTISTE.MaterialTransformations.
class MaterialTransformations {
  // Converts a bumpMap to a normalMap
  static bumpCanvasToNormalCanvas(bumpCanvas, {normalCanvas, bumpScale, invert = false, alphaOnly = false} = {}) {
    let bumpCtx = bumpCanvas.getContext('2d')
    let bumpData = bumpCtx.getImageData(0, 0, bumpCanvas.width, bumpCanvas.height)

    let sampleBump = alphaOnly ?
                      (i,j) => bumpData.data[4*(j * bumpCanvas.width + i) + 3] / 255.0 + 0.5
                    : (i,j) => bumpData.data[4*(j * bumpCanvas.width + i) + 0] / 255 * bumpData.data[4*(j * bumpCanvas.width + i) + 3] / 255.0 + 0.5

    if (typeof normalCanvas === 'undefined') {
      normalCanvas = document.createElement('canvas')
      normalCanvas.width = bumpCanvas.width
      normalCanvas.height = bumpCanvas.height
    }

    let normalCtx = normalCanvas.getContext('2d')
    let normalData = normalCtx.getImageData(0, 0, normalCanvas.width, normalCanvas.height)

    let setNormal = (x,y,v) => {
      let i = Math.floor(x / bumpCanvas.width * normalCanvas.width)
      let j = Math.floor(y / bumpCanvas.height * normalCanvas.height)
      normalData.data[4*(j * normalCanvas.width + i) + 0] = v.x * 255
      normalData.data[4*(j * normalCanvas.width + i) + 1] = v.y * 255
      normalData.data[4*(j * normalCanvas.width + i) + 2] = v.z * 255
      normalData.data[4*(j * normalCanvas.width + i) + 3]  = 255
    }

    let setNormalSwizzle = (x,y,v) => {
      let i = Math.floor(x / bumpCanvas.width * normalCanvas.width)
      let j = Math.floor(y / bumpCanvas.height * normalCanvas.height)
      normalData.data[4*(j * normalCanvas.width + i) + 0] = v.x * 255
      normalData.data[4*(j * normalCanvas.width + i) + 1] = (1.0 - v.y) * 255
      normalData.data[4*(j * normalCanvas.width + i) + 2] = v.z * 255
      normalData.data[4*(j * normalCanvas.width + i) + 3]  = 255
    }

    if (invert) {
      setNormal = setNormalSwizzle
    }

    let vec = new THREE.Vector3()

    let scale = bumpScale ? (1.5 - bumpScale) : 1.0 / 10.0
    // let scale = 1.0 / 10.0

    console.log("Using bump scale", scale)

    for (let x = 0; x < bumpCanvas.width; ++x)
    {
      for (let y = 0; y < bumpCanvas.height; ++y)
      {
        if (x == 0 || x == bumpCanvas.width - 1 || y == 0 || y == bumpCanvas.height - 1)
        {
          vec.set(0.5, 0.5, 1)
          setNormal(x, y, vec)
          continue
        }
        let height_pu = sampleBump(x + 1, y)
        let height_mu = sampleBump(x - 1, y)
        let height_pv = sampleBump(x, y + 1)
        let height_mv = sampleBump(x, y - 1)
        let du = height_mu - height_pu
        let dv = height_mv - height_pv
        vec.set(du, dv, scale).normalize()
        vec.x += 0.5
        vec.y += 0.5
        vec.clampScalar(0.0, 1.0)
        setNormal(x,y,vec)
      }
    }

    normalCtx.putImageData(normalData, 0, 0)

    return normalCanvas
  }

  // Puts roughness texture canvas into metalness texture canvas
  static putRoughnessInMetal(roughness, metalness)
  {
    let defaultMetalness = false;
    let defaultRoughness = false
    if (metalness && metalness.id && metalness.id.startsWith("default-"))
    {
      metalness = undefined
    }
    if (roughness && roughness.id && roughness.id.startsWith("default-"))
    {
      roughness = undefined
    }

    if (!metalness)
    {
      metalness = document.createElement('canvas')
      metalness.width = roughness ? roughness.width : 24
      metalness.height = roughness ? roughness.height : 24
      let metalCtx = metalness.getContext('2d')

      if (!roughness)
      {
        metalCtx.fillStyle = "#FFFF00"
        metalCtx.fillRect(0,0, metalness.width, metalness.height)
        return metalness;
      }
      else
      {
        metalCtx.fillStyle = "#000"
        metalCtx.fillRect(0,0, metalness.width, metalness.height)
      }
    }
    else if (!roughness)
    {
      roughness = document.createElement('canvas')
      roughness.width = metalness.width
      roughness.height = metalness.height
      let roughCtx = roughness.getContext('2d')
      roughCtx.fillStyle = "#000"
      roughCtx.fillRect(0, 0, roughness.width, roughness.height)

      // metalness = Util.cloneCanvas(metalness)
    }

    if (metalness.width !== roughness.width || metalness.height !== roughness.height)
    {
      console.warn("Metalness and roughness are not same dimensions", metalness, roughness)
    }

    let csp = this.csp;
    if (!csp) {
      csp = this.csp = new CanvasShaderProcessor({source: require('./shaders/combine-metal-roughness.glsl')})
    }
    csp.setInputCanvas(metalness)
    csp.setCanvasAttribute('u_roughness', roughness)
    csp.update()
    // let roughCtx = roughness.getContext('2d')
    // let metalCtx = metalness.getContext('2d')
    //
    // let roughData = roughCtx.getImageData(0,0, roughness.width, roughness.height)
    // let metalData = metalCtx.getImageData(0,0, roughness.width, roughness.height)
    //
    // for (let j = 0; j < roughness.height; ++j)
    // {
    //   for (let i = 0; i < roughness.width; ++i)
    //   {
    //     metalData.data[4*(j * roughness.width + i) + 1] = roughData.data[4*(j * roughness.width + i) + 1]
    //     // metalData.data[4*(j * roughness.width + i) + 2] = v.z * 255
    //     metalData.data[4*(j * roughness.width + i) + 3]  = 255
    //   }
    // }
    //
    // metalCtx.putImageData(metalData, 0, 0)

    return Util.cloneCanvas(csp.canvas)//metalness
  }

  // Checks if a material's diffuse map has any transparent pixels
  static checkTransparency(material) {
    if (!material.map || !material.map.image)
    {
      return
    }

    let canvas = material.map.image
    let ctx = canvas.getContext('2d')
    let imgData = ctx.getImageData(0, 0, canvas.width, canvas.height)

    const ALPHA_CUTOFF = 245

    for (let j = 0; j < canvas.height; ++j)
    {
      for (let i = 0; i < canvas.width; ++i)
      {
        if (imgData.data[4*(j * canvas.width + i) + 3]  < ALPHA_CUTOFF)
        {
          //console.log("Found transparent pixel", imgData.data[4*(j * canvas.width + i) + 3])
          return
        }
      }
    }
    material.transparent = false
  }

  // Converts a vec2 geometry bufferAttribute to a vec3
  static vec2toVec3Attribute(model)
  {
    let position = model.geometry.attributes.position
    let newPositions = []
    newPositions.length = Math.floor(position.array.length / 2.0 * 3)
    let newI = 0;
    for (let i = 0; i < position.array.length; ++i)
    {
      newPositions[newI++] = position.array[i]
      if (i % 2 == 0) newPositions[newI++] = 0.0;
    }
    model.geometry.removeAttribute('position')
    model.geometry.addAttribute('position', new THREE.Float32BufferAttribute(newPositions, 3))
  }

  static dedupMaterials(rootOrMeshes, {undoStack} = {})
  {
    function materialHash(material, imageHash) {
      let parts = []
      for (let m of ['map'].concat(THREED_MODES))
      {
        if (!material[m]) continue;
        if (!material[m].image) continue;

        let hash = imageHash.get(material[m].image)
        if (!hash)
        {
          hash = shortid.generate()
          imageHash.set(material[m].image, hash)
        }

        parts.push(hash)
      }
      parts.push(material.color.getHexString())
      parts.push(material.type)
      parts.push(material.opacity)
      return parts.join()
    }
    let meshes = rootOrMeshes
    if (!rootOrMeshes.length)
    {
      meshes = Util.traverseFindAll(rootOrMeshes, m => m.visible && m.material)
    }

    let imageHash = new Map;
    let originalMaterials = new Map;
    let materialCache = new Map;

    for (let m of meshes)
    {
      if (!m.material) continue;

      let hash = materialHash(m.material, imageHash)
      let cached = materialCache.get(hash)

      if (!cached)
      {
        materialCache.set(hash, m.material)
        cached = m.material
      }

      if (undoStack) {
        originalMaterials.set(m, m.material)
      }

      m.material = cached
    }

    if (undoStack) {
      undoStack.push(() => {
        for (let [m, material] of originalMaterials.entries())
        {
          m.material = material
        }
      })
    }
  }

  // Runs preprocessing to deal with quirks of the THREE.GLTFExporter
  static prepareModelForExport(model, material, {undoStack} = {}) {
    if (!material) material = model.material
    // console.log("Preparing", model, material)

    if (model.geometry && model.geometry.attributes)
    {
      // if (undoStack) {
      //   let oldGeometry = model.geometry
      //   undoStack.push(() => model.geometry = oldGeometry)
      // }
      Util.deinterleaveAttributes(model.geometry)
    }

    if (model.geometry && model.geometry.attributes && model.geometry.attributes.position && model.geometry.attributes.position.itemSize !== 3)
    {
      if (undoStack) undoStack.push(() => model.visible = true)
      model.visible = false
      // MaterialTransformations.vec2toVec3Attribute(model)
    }

    if (model.geometry && !model.geometry.getAttribute)
    {
      if (undoStack) undoStack.push(() => model.visible = true)
      model.visible = false
      // MaterialTransformations.vec2toVec3Attribute(model)
    }

    if (model.el && model.el.hasAttribute('frame') && !model.el.getAttribute('frame').closeable)
    {
      if (undoStack) undoStack.push(() => model.visible = true)
      model.visible = false
      // MaterialTransformations.vec2toVec3Attribute(model)
    }

    if (model.geometry && model.geometry.attributes.tangent)
    {
      if (model.geometry.attributes.tangent.count !== Math.floor(model.geometry.attributes.tangent.count)) {
        console.warn("Deleting non-integral tangent attribute from", model, model.geometry.attributes.tangent)
        model.geometry.deleteAttribute('tangent')
      }
    }

    if (!material) return;


    if (material.bumpMap && material.bumpMap.image) {
      console.log("Bumping into normal")
      if (material.normalMap) console.warn("Ignoring existing normal map")
      material.normalMap = new THREE.Texture()
      material.normalMap.flipY = material.bumpMap.flipY
      if (material.bumpMap.image.nodeName !== "CANVAS")
      {
        if (undoStack) {
          let originalImage = material.bumpMap.image
          undoStack.push(() => material.bumpMap.image = originalImage)
        }
        material.bumpMap.image = Util.cloneCanvas(material.bumpMap.image)
      }
      else if (undoStack) { undoStack.pushCanvas(material.bumpMap.image)}
      material.normalMap.image = MaterialTransformations.bumpCanvasToNormalCanvas(material.bumpMap.image)
      material.normalMap.wrapS = material.bumpMap.wrapS
      material.normalMap.wrapT = material.bumpMap.wrapT
    }

    if (material.roughnessMap && material.roughnessMap.image &&
        material.metalnessMap && material.metalnessMap.image &&
        material.metalnessMap === material.roughnessMap)
    {
      console.log("Not combining metallic roughness. Not needed")
    }
    else if (material.roughnessMap && material.roughnessMap.image) {
      console.log("Combining roughness into metalness")
      if (undoStack) {
        let originalRoughness = material.roughnessMap
        let originalMetalness = material.metalnessMap
        let originalMetalnessImage = originalMetalness ? originalMetalness.image : null
        undoStack.push(() => {
          material.roughnessMap = originalRoughness
          material.metalnessMap = originalMetalness
          if (originalMetalnessImage) material.metalnessMap.image = originalMetalnessImage
          if (material.metalnessMap) material.metalnessMap.needsUpdate = true
          material.needsUpdate = true
          console.log("Restored original metall / roughness")
          // material.roughnessMap.image = originalImage;
        })
      }

      if (!material.metalnessMap)
      {
        material.metalnessMap = new THREE.Texture()
        material.metalnessMap.wrapS = material.roughnessMap.wrapS
        material.metalnessMap.wrapT = material.roughnessMap.wrapT
      }
      material.metalnessMap.image = MaterialTransformations.putRoughnessInMetal(material.roughnessMap.image, material.metalnessMap.image)
      // Util.debugCanvas(material.metalnessMap.image)
      material.metalnessMap.needsUpdate = true
      material.roughnessMap = material.metalnessMap
      material.needsUpdate = true
    }
    else if (material.metalnessMap)
    {
      let roughCanvas = document.createElement('canvas')
      roughCanvas.width = material.metalnessMap.image.width
      roughCanvas.height = material.metalnessMap.image.height
      let roughCtx = roughCanvas.getContext('2d')
      roughCtx.fillStyle = "#000"
      roughCtx.fillRect(0,0,roughCanvas.width,roughCanvas.height)
      if (material.metalnessMap.image.nodeName !== "CANVAS")
      {
        if (undoStack) {
          let originalImage = material.metalnessMap.image
          undoStack.push(() => material.metalnessMap.image = originalImage)
        }
        material.metalnessMap.image = Util.cloneCanvas(material.metalnessMap.image)
      } else if (undoStack) { undoStack.pushCanvas(material.metalnessMap.image)}
      MaterialTransformations.putRoughnessInMetal(roughCanvas, material.metalnessMap.image)
      material.roughnessMap = material.metalnessMap
      material.needsUpdate = true
    }

    if (material.map && material.map.image)
    {
      if (material.map.image.nodeName !== "CANVAS" && material.map.image.nodeName !== "IMG")
      {
        if (undoStack) {
          let originalImage = material.map.image
          undoStack.push(() => material.map.image = originalImage)
        }

        try {
          material.map.image = Util.cloneCanvas(material.map.image)
        } catch (e) {
          if (undoStack)
          {
            let originalMap = material.map
            undoStack.push(() => material.map = originalMap)
          }
          material.map = null
          console.warn("Can't use texture, skipping: ", model, material.map, e)
          return
        }
      }
      if (material.map.image.nodeName !== "IMG")
      {
        MaterialTransformations.checkTransparency(material)
      }
    }

    if (model.skeleton && !model.isSkinnedMesh)
    {
      model.isSkinnedMesh = true
      undoStack.push(() => model.isSkinnedMesh = false)
    }

    if (model.skeleton && !material.skinning)
    {
      material.skinning = true
      undoStack.push(() => material.skinning = false)
    }
  }

  static combineMaterials(object)
  {
    let materialCache = {}
    let materialId = (material) => material.map ? material.map.uuid : material.uuid;
    // materialCache[materialId(o.material)] = o.material

    let materialList = Object.values(materialCache)

    if (materialList.length === 1) return materialList[0]
    if (materialList.length === 0) return new THREE.MeshBasicMaterial();

    let boxes = Util.divideCanvasRegions(materialList.length)

    let currentBoxId = 0
    let currentBox = new THREE.Box2(new THREE.Vector2(0, 0), new THREE.Vector2(1, 1))
    let materialBoxes = {}
    let shouldUse3D = Compositor.el.getAttribute('material').shader === 'standard'
    let doubleSided = Compositor.component.data.doubleSided

    let modeCanvases = {}

    materialParams = {}

    for (let material of materialList)
    {
      currentBox = boxes[currentBoxId++]
      materialBoxes[materialId(material)] = currentBox

      if (material.side === THREE.DoubleSide || material.side === THREE.BackSide)
      {
        doubleSided = true
      }

      for (let mode of ["map"].concat(THREED_MODES))
      {
        if (material[mode] || mode === 'map')
        {
          let image = material[mode] ? material[mode].image : undefined
          let {width, height} = Compositor.component
          let canvas = modeCanvases[mode]
          if (!canvas)
          {
            canvas = document.createElement('canvas')
            Util.ensureSize(canvas, width, height)
            modeCanvases[mode] = canvas
            materialParams[mode] = new THREE.Texture(canvas)
            Util.fillDefaultCanvasForMap(canvas, mode, {replace: true});
          }
          let ctx = canvas.getContext('2d')

          if (image)
          {
            ctx.drawImage(image, 0, 0, image.width, image.height,
                                 box.min.x, box.min.y, box.max.x, box.max.y)
          }
        }
      }
    }

    return new THREE.MeshStandardMaterial(materialParams)
  }
}

const {prepareModelForExport, bumpCanvasToNormalCanvas, checkTransparency, dedupMaterials} = MaterialTransformations

export {prepareModelForExport, bumpCanvasToNormalCanvas, checkTransparency, dedupMaterials, MaterialTransformations}

// System to allow easy exporting of entities and objects as GLB files. Can also
// be used as a component on an entity.
//
// ### Current Limitations:
//
//  - Can't handle text
//  - No custom shaders
//  - May mess up some objects or materials (though `restoreAfterExport` should
//    fix most of it)
Util.registerComponentSystem('glb-exporter', {
  init() {},

  // Returns a promise which resolves to an array buffer containing the GLB file
  // contents.  `object3D` may be an `a-entity` or a `THREE.Object3D`, or
  // `undefined`, in which case it will be set to the component's element (or
  // the scene for the system). `object3D` and all of its visible descendents
  // will be stored.
  //
  // **Note:** if `restoreAfterExport` is true, this method will make an attempt
  // to restore the object to its original state, but this is not yet thoroughly
  // vetted, so be careful when using.
  async getExportableGLB(object3D = undefined, {restoreAfterExport = true} = {})
  {
    if (!object3D) object3D = this.el.object3D
    if (object3D instanceof AFRAME.AEntity) object3D = object3D.el

    let undoStack = restoreAfterExport ? new UndoStack({maxSize: -1}) : null

    object3D.traverse(o => {
      if (o.material) {
        prepareModelForExport(o, o.material, {undoStack})
      }
    })
    let exporter = new THREE.GLTFExporter()
    let glb = await new Promise((r, e) => {
      exporter.parse(object3D, r, {binary: true, animations: object3D.animations || [], includeCustomExtensions: true, onlyVisible: true})
    })

    while (undoStack && undoStack.stack.length)
    {
      undoStack.undo()
    }

    return glb
  },

  // Asynchronously initiates a download of a GLB file containing `object3D` and
  // all of its descendents. `object3D` may be an `a-entity` or a
  // `THREE.Object3D`, or `undefined`, in which case it will be set to the
  // component's element (or the scene for the system). The file will be named
  // `filename` (if given) or have an autogenerated file name. Additional named
  // options may be passed through to `getExportableGLB`
  //
  // **Note:** if `restoreAfterExport` is true, this method will make an attempt
  // to restore the object to its original state, but this is not yet thoroughly
  // vetted, so be careful when using. Additional, `restoreAfterExport` may
  // require quite a bit of memory to work properly, so find what works best for
  // your application.
  async downloadGLB(object3D = undefined, {filename = undefined, ...opts} = {})
  {
    let glb = await this.getExportableGLB(object3D, opts)

    if (!filename) filename = `vartiste-toolkit-export.glb`
    if (!filename.endsWith('.glb')) filename = filename + ".glb"

    let desktopLink = document.createElement('a');
    desktopLink.href = "data:application:/x-binary;base64," + base64ArrayBuffer(glb);
    desktopLink.style = "z-index: 10000; position: absolute; top: 50%; left: 50%; padding: 5px; background-color: #eee; transform: translate(-50%,-50%)"
    desktopLink.innerHTML = "Open GLB";
    desktopLink.download = filename;
    desktopLink.click()
  }
})

class MeshPBMatcapMaterial extends THREE.ShaderMaterial {
  constructor(parameters = {})
  {
    super(parameters)
    let originalMatcap = document.getElementById('pbmatcap-placeholder').components.material.material
    this.copy(originalMatcap)
    for (let k in originalMatcap.uniforms)
    {
      this.uniforms[k].value = originalMatcap.uniforms[k].value
    }
    for (let k in parameters)
    {
      if (k in this.uniforms)
      {
        this[k] = parameters[k]
        this.uniforms[k].value = parameters[k]
      }
      else if (['alphaTest', 'transparent', 'depthWrite', 'side', 'opacity'].includes(k)) {
        this[k] = parameters[k]
        console.log("Settting param", k, parameters[k])
      }
    }
    this.matcap = true
    this.normalMapType = 0
  }
  copy(source) {
    super.copy(source)
    for (let k in source.uniforms)
    {
      this.uniforms[k].value = source.uniforms[k].value
      this[k] = source[k]
    }
    this.matcap = true
    this.normalMapType = 0
    return this
  }
  clone() {
    return new MeshPBMatcapMaterial().copy(this)
  }
}

THREE.MeshPBMatcapMaterial = MeshPBMatcapMaterial;
