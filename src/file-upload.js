import {Layer} from './layer.js'
import shortid from 'shortid'
import {THREED_MODES} from './layer-modes.js'
import {RGBELoader} from './framework/RGBELoader.js'
import {Util} from './util.js'
import {Pool} from './pool.js'
import Pako from 'pako'
import JSZip from 'jszip'
import {base64ArrayBuffer} from './framework/base64ArrayBuffer.js'
import {ffmpeg} from './framework/ffmpeg.js'

const HANDLED_MODEL_FORMAT_REGEX = /\.(glb|obj|vrm|gltf|fbx)$/i;

class URLFileAdapter {
  constructor(url) {
    this.url = url
    this.name = url
  }
  async text() {
    let resp = await fetch(this.url)
    return await resp.text()
  }
  async arrayBuffer() {
    let resp = await fetch(this.url)
    return await resp.arrayBuffer()
  }
}

export function toSrcString(file) {
  if (file instanceof File) return URL.createObjectURL(file)
  if (file instanceof URLFileAdapter) return file.url
  if (file instanceof Blob) return URL.createObjectURL(file)
  return file
}

async function addImageLayer(file, {setMapFromFilename = false} = {}) {
  let image = new Image()
  image.src = toSrcString(file)
  image.id = "img"
  image.crossOrigin = 'anonymous'

  await new Promise((r,e) => image.onload = r)
  image.onload = undefined

  let layer = new Layer(image.width, image.height)
  layer.canvas.getContext('2d').drawImage(image, 0, 0)

  if (file.name && setMapFromFilename)
  {
    let map = Util.mapFromFilename(file.name)
    if (map) {
      layer.mode = map
    }
  }

  let compositor = document.getElementById('canvas-view').components.compositor
  compositor.addLayer(compositor.layers.length - 1, {layer})
}

export function addImageReferenceViewer(image) {
  let viewer = document.createElement('a-entity')
  viewer.setAttribute('geometry', `primitive: plane; width: 1; height: ${image.height / image.width}`)
  viewer.setAttribute('material', {src: image, shader: 'flat', transparent: true, side: 'double'})
  viewer.setAttribute('position')
  viewer.setAttribute('frame', 'closable: true; autoHide: true')
  viewer.classList.add("clickable")
  viewer.classList.add("reference-image")
  document.querySelector('#reference-spawn').append(viewer)
  Util.whenLoaded(viewer, () => {
    let toLayer = viewer.components.frame.addButton('#asset-archive-arrow-down-outline')
    toLayer.setAttribute('tooltip', 'Convert To Layer')
    toLayer.addEventListener('click', () => {
      let layer = new Layer(image.width, image.height)
      layer.canvas.getContext('2d').drawImage(image, 0, 0)
      Compositor.component.addLayer(Compositor.component.layers.length - 1, {layer})
    })
  })
  return viewer
}

async function addImageReference(file) {
  let image = new Image()
  image.src = toSrcString(file)
  image.id = "img"

  await new Promise((r,e) => image.onload = r)
  image.onload = undefined

  return addImageReferenceViewer(image)
}

async function addHDRImage(file) {
  await new Promise( (r,e) => {
		new RGBELoader()
			.setDataType( THREE.UnsignedByteType ) // alt: FloatType, HalfFloatType
			.load( toSrcString(file) , function ( texture, textureData ) {
        document.querySelector('a-scene').systems['environment-manager'].installHDREnvironment(texture)
				r()
			} );
  })
}

async function addMovieLayer(file) {
  if (!ffmpeg.isLoaded())
  {
    await ffmpeg.load()
  }

  let extension = file.name.match(/\.([^\.]*)$/)[1]

  let layer;

  let intermediateFormat = 'bmp'

  await ffmpeg.FS("writeFile", `input.${extension}`, await ffmpeg.fetchFile(file))

  console.log("Video Info --->")

  let foundInput = false
  let durationSeconds
  let fps
  let width
  let height

  ffmpeg.setLogger(({ type, message }) => {
  /*
   * type can be one of following:
   *
   * info: internal workflow debug messages
   * fferr: ffmpeg native stderr output
   * ffout: ffmpeg native stdout output
   */
   if (type === 'fferr')
   {
     if (/^Input \#/.test(message))
     {
       foundInput = true
       return
     }

     if (!foundInput)
     {
       return;
     }

     let m
     if (m = message.match(/Duration: (\d+):(\d+):([\d\.]+),/))
     {
       durationSeconds = parseFloat(m[1]) * 60 * 60 + parseFloat(m[2]) * 60 + parseFloat(m[3])
     }
     else if (m = message.match(/Stream #.*: Video:.*, (\d+)x(\d+).* ([\d\.]+) fps,/))
     {
       width = parseInt(m[1])
       height = parseInt(m[2])
       fps = parseFloat(m[3])
     }
   }
 })

  await ffmpeg.run('-i', `input.${extension}`)

  let numberOfFrames = fps * durationSeconds

  console.log("Info", {durationSeconds, fps, width, height, numberOfFrames})

  if ([durationSeconds, fps, width, height, numberOfFrames].some(a => !a))
  {
    console.error("Missing Info!")
    return;
  }

  ffmpeg.setLogger(function(){})

  if (numberOfFrames > 100)
  {
    await ffmpeg.run("-i", `input.${extension}`, "-r", `${100 / durationSeconds}`, `%01d.${intermediateFormat}`)
  }
  else
  {
    await ffmpeg.run("-i", `input.${extension}`, "-r", "1/1", `%01d.${intermediateFormat}`)
  }

  let i = 1
  while (true) {
    let frame
    try {
      frame = await ffmpeg.FS('readFile', `${i}.${intermediateFormat}`)
      ffmpeg.FS('unlink', `${i}.${intermediateFormat}`)
      console.log("Read frame", i)

    }
    catch (e)
    {
      console.log("Done reading", e)
      break;
    }

    // document.querySelector('a-scene').systems['settings-system'].download("data:application/x-binary;base64," + base64ArrayBuffer(frame), {extension: 'png'}, "Animation")

    let blob = new Blob([frame], {type: `image/${intermediateFormat}`})
    let image = new Image
    image.src = toSrcString(blob)
    await image.decode()
    // await new Promise((r,e) => image.onload = r)

    let canvas
    if (!layer)
    {
      layer = new Layer(image.width, image.height)
      Compositor.component.addLayer(undefined, {layer})
      canvas = layer.canvas
    }
    else
    {
      Compositor.component.addFrameAfter()
      canvas = layer.frame(i - 1)
    }

    canvas.getContext('2d').drawImage(image, 0, 0)

    i++;
  }
}

async function addMovieReference(file)
{
  let video = document.createElement('video')
  video.src = toSrcString(file)

  console.log("Waiting for video to load", video)

  await video.play()
  video.width = video.videoWidth
  video.height = video.videoHeight
  video.loop = true
  video.onload = undefined

  return addImageReferenceViewer(video)
}

var defaultStandardMaterial = new THREE.MeshStandardMaterial();

async function addGlbViewer(file, {postProcessMesh = true, loadingManager = undefined, sceneName = undefined} = {}) {
  let id = shortid.generate()
  let asset = document.createElement('a-asset-item')
  asset.id = `asset-model-${id}`

  if (document.querySelector('a-scene').systems['settings-system'].projectName === 'vartiste-project')
  {
    document.querySelector('a-scene').systems['settings-system'].setProjectName((sceneName || file.name).replace(HANDLED_MODEL_FORMAT_REGEX, ""))
  }

  let format = 'glb'

  switch (file.name.slice(-4).toLowerCase())
  {
    case '.obj': format = 'obj'; break
    case '.fbx': format = 'fbx'; break
    case '.vrm': format = 'vrm'; break
  }

  let model

  if (format === 'obj')
  {
    let loader = new THREE.OBJLoader(loadingManager)
    model = new THREE.Object3D()
    let buffer = await file.text()
    model.scene = loader.parse(buffer)
    model.add(model.scene)
  }
  else if (format === 'fbx')
  {
    const { FBXLoader } = await import('./framework/FBXLoader.js')
    let loader = new FBXLoader(loadingManager)
    let buffer = await file.arrayBuffer()
    model = new THREE.Object3D()
    model.scene = loader.parse(buffer)
    model.add(model.scene)
  }
  else
  {
    let loader = new THREE.GLTFLoader(loadingManager)
    let buffer = await file.arrayBuffer()
    try {
      model = await new Promise((r, e) => loader.parse(buffer, "", r, e))
    }
    catch (e) {
      console.error("Could not load model", e)
      window.loadErrorBuffer = buffer
      return
    }
  }

  console.log("loaded", model)

  await importModelToMesh(model, {postProcessMesh, sceneName, format})
}

export async function importModelToMesh(model, {postProcessMesh = true, sceneName = undefined, format, combineMaterials, importMaterial, replaceMesh} = {})
{
  let compositor = Compositor.component

  let startingLayerLength = compositor.layers.length

  let startingLayer = compositor.activeLayer

  if (typeof combineMaterials === 'undefined') combineMaterials = compositor.el.sceneEl.components['file-upload'].data.combineMaterials
  if (typeof importMaterial === 'undefined') importMaterial = compositor.el.sceneEl.components['file-upload'].data.importMaterial
  if (typeof replaceMesh === 'undefined') importMaterial = compositor.el.sceneEl.components['file-upload'].data.replaceMesh

  let materials = {}

  let materialId = (material) => material.map ? material.map.uuid : material.uuid;

  let uiElementsToRemove = []

  model.scene.traverse(o => {
    if (o.userData.vartisteUI)
    {
      uiElementsToRemove.push(o)
      return;
    }
    if (o.geometry) {
      Util.deinterleaveAttributes(o.geometry)

      if (postProcessMesh && o.geometry.index)
      {
        o.geometry = o.geometry.toNonIndexed()
      }

      if (!o.geometry.attributes.normal)
      {
        o.geometry.computeVertexNormals()
      }
    }
  })

  for (let o of uiElementsToRemove)
  {
    o.parent.remove(o)
  }

  let transparentCollisions = {opaqueMeshes: [], transparentMeshes: []}
  model.scene.traverse(o => {
    if (o.materials || (o.material && o.material.length)) console.warn("Multimaterial!", o, o.material)
    if (o.material)
    {
      materials[materialId(o.material)] = o.material
      if (postProcessMesh)
      {
        if (o.material.transparent) {
          transparentCollisions.transparentMeshes.push(o)
        }
        else
        {
          transparentCollisions.opaqueMeshes.push(o)
        }
      }
    }
  })

  let boxes
  if (combineMaterials)
  {
    boxes = Util.divideCanvasRegions(Object.keys(materials).length)
  }

  let currentBoxId = 0
  let currentBox = new THREE.Box2(new THREE.Vector2(0, 0), new THREE.Vector2(1, 1))
  let materialBoxes = {}
  let shouldUse3D = Compositor.el.getAttribute('material').shader === 'standard'
  let doubleSided = Compositor.component.data.doubleSided
  if (importMaterial)
  {
    for (let material of Object.values(materials))
    {
      if (combineMaterials)
      {
        currentBox = boxes[currentBoxId++]
        materialBoxes[materialId(material)] = currentBox
      }

      if (material.side === THREE.DoubleSide || material.side === THREE.BackSide)
      {
        doubleSided = true
      }

      for (let mode of ["map"].concat(THREED_MODES))
      {
        if (material[mode] || mode === 'map')
        {
          if (mode === 'roughnessMap' || mode === 'metalnessMap' || mode === 'emissiveMap' || 'aoMap') shouldUse3D = true
          let image = material[mode] ? material[mode].image : undefined
          let {width, height} = compositor
          let layer = new Layer(width, height)
          let layerCtx = layer.canvas.getContext('2d')
          layerCtx.save()

          console.log("Material", material)

          //layerCtx.scale(1, -1)
          if (!material.transparent || (!image && postProcessMesh))
          {
            if (mode === 'map'  && material.color)
            {
              console.log("coloring", material.color)
              let oldOpacity = layerCtx.globalAlpha
              layerCtx.fillStyle = material.color.convertLinearToSRGB().getStyle()
              layerCtx.globalAlpha = material.opacity
              layerCtx.fillRect(0, 0, width, height)
              layerCtx.globalAlpha = oldOpacity
            }
          }

          if (mode === 'metalnessMap' || mode === 'roughnessMap')
          {
            let intensityAttribute = mode.slice(0, -3)
            if (material[intensityAttribute] !== defaultStandardMaterial[intensityAttribute])
            {
              console.log("Applying scalar for", mode)
              layerCtx.fillStyle = `rgba(${material[intensityAttribute]}, ${material[intensityAttribute]}, ${material[intensityAttribute]}, 255)`
              layerCtx.fillRect(0, 0, width, height)
            }
          }

          if (image)
          {
            layerCtx.translate(width / 2, height / 2)
            try {
              layerCtx.drawImage(image, -width / 2, -height / 2, width, height)
              if (mode === 'map')
              {
                layerCtx.fillStyle = material.color.convertLinearToSRGB().getStyle()
                layerCtx.globalCompositeOperation = 'multiply'
                layerCtx.fillRect( -width / 2, -height / 2, width, height)
                layerCtx.globalCompositeOperation = 'destination-in'
                layerCtx.drawImage(image, -width / 2, -height / 2, width, height)
                layerCtx.globalCompositeOperation = 'source-over'
              }
            } catch (e)
            {
              console.log("Could not draw image for texture", mode, material)
            }
          }
          layerCtx.restore()
          if (mode !== "map")
          {
            layer.mode = mode
          }
          layer.transform.scale.x = currentBox.max.x - currentBox.min.x
          layer.transform.scale.y = currentBox.max.y - currentBox.min.y
          layer.transform.translation.x = width * ((currentBox.min.x + currentBox.max.x) / 2 - 0.5)
          layer.transform.translation.y = height * ((currentBox.min.y + currentBox.max.y) / 2 - 0.5)
          compositor.addLayer(0, {layer})
        }
      }
    }

    // Prevent double adjustment
    let hasAdjustedGeometry = {}
    let adjustedArrays = new Set()

    if (combineMaterials)
    {
      model.scene.traverse(o => {

        if (o.material && o.geometry.attributes.uv)
        {
          if (hasAdjustedGeometry[o.geometry.uuid]) return;

          let attr = o.geometry.attributes.uv
          let geometry = o.geometry
          let currentBox = materialBoxes[materialId(o.material)]

          //geometry = geometry.toNonIndexed()

          if (attr.data)
          {
            if (adjustedArrays.has(attr.data)) return;
            Util.applyUVBox(currentBox, geometry);
            adjustedArrays.add(attr.data)
          }
          else
          {
            if (adjustedArrays.has(geometry.attributes.uv.array)) return;
            Util.applyUVBox(currentBox, geometry);
            if (!geometry.index) adjustedArrays.add(geometry.attributes.uv.array)
          }
          //o.geometry = geometry
          geometry.attributes.uv.needsUpdate = true
          hasAdjustedGeometry[geometry.uuid] = true
        }
      })

      for (let mode of THREED_MODES)
      {
        let {width, height} = compositor
        let saveLayer = new Layer(width, height)
        saveLayer.mode = mode
        let deleteLayers = []
        let ctx = saveLayer.canvas.getContext('2d')

        switch (mode) {
          case 'normalMap':
            ctx.fillStyle = 'rgb(128, 128, 255)'
            ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height)
          break;
          case 'bumpMap':
          case 'metalnessMap':
            ctx.fillStyle = 'rgb(0, 0, 0)'
            ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height)
          break;
          case 'roughnessMap':
            ctx.fillStyle = 'rgb(255, 255, 255)'
            ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height)
          break;
        }

        for (let layer of compositor.layers)
        {
          if (layer.mode !== mode) continue
          if (!saveLayer) {
            saveLayer = layer
            continue
          }
          compositor.mergeLayers(layer, saveLayer)
          deleteLayers.push(layer)
        }
        if (deleteLayers.length === 0) continue
        compositor.addLayer(0, {layer: saveLayer})
        for (let layer of deleteLayers) {
          if (layer !== startingLayer)
          compositor.deleteLayer(layer)
        }
      }
    }
  }

  console.log("Materials imported")

  AFRAME.utils.extendDeep(model.scene.userData, model.userData)

  document.getElementsByTagName('a-scene')[0].systems['settings-system'].addModelView(model, {replace: replaceMesh})

  if (Compositor.el.getAttribute('material').shader === 'flat')
  {
    Compositor.el.setAttribute('material', 'shader', shouldUse3D ? 'standard' : 'matcap')
  }

  Compositor.el.setAttribute('compositor', 'doubleSided', doubleSided)

  compositor.activateLayer(startingLayer);

  if (!postProcessMesh) return;

  (async () => {
    if (!Util.traverseFind(model.scene, o => o.geometry && o.geometry.attributes.uv))
    {
      await compositor.el.sceneEl.systems['uv-unwrapper'].quickBoundingBoxUnwrap()
    }

    if (importMaterial && Compositor.meshes.some(o => o.geometry && o.geometry.attributes.uv && o.geometry.attributes.color))
    {
      try {
        let layer = new Layer(Compositor.component.width, Compositor.component.height)
        Compositor.component.addLayer(0, {layer})
        compositor.el.sceneEl.systems['mesh-tools'].bakeVertexColorsToTexture({layer: layer})
        while (compositor.layers.indexOf(compositor.activeLayer) > startingLayerLength)
        {
          compositor.swapLayers(compositor.activeLayer, compositor.layers[compositor.layers.indexOf(compositor.activeLayer) - 1])
        }
      }
      catch (e) {
        console.error("Could not bake vertex colors", e)
      }
    }

    // Handle Decals
    if (transparentCollisions.transparentMeshes.length > 0) console.log("transparentCollisions", transparentCollisions)
    for (let transparentMesh of transparentCollisions.transparentMeshes)
    {
      if (transparentCollisions.opaqueMeshes.some(o => o.parent === transparentMesh.parent && o.position.equals(transparentMesh.position)))
      {
        transparentMesh.position.z -= 0.001
      }
    }

    if (format === 'vrm')
    {
      Compositor.meshRoot.parent.rotation.set(0, Math.PI, 0)
    }

    Compositor.meshRoot.traverse(o => {
      if (o.geometry && o.geometry && o.geometry.attributes.position && o.geometry.attributes.position.count > 6) {
        o.geometry.computeBoundsTree();
      }
    })

    compositor.activateLayer(startingLayer);
  })()
}

export function setupGlbReferenceEntity(entity) {
  entity.classList.add("clickable")
  entity.setAttribute("reference-glb", '')

  if (!document.querySelector('a-scene').getAttribute('renderer').colorManagement)
  {
    // Change image encoding to linear. Don't know if this is right, or if we
    // should change the export, but all models seem to look better this way
    entity.getObject3D('mesh').traverse(o => {
      if (o.type == "Mesh" || o.type == "SkinnedMesh") {
        if (o.material && o.material.map) {
            o.material.map.encoding = THREE.LinearEncoding
            o.material.needsUpdate = true
        }
      }
    })
  }

  entity.getObject3D('mesh').traverse(o => {
    if (o.geometry) {
      Util.deinterleaveAttributes(o.geometry)
      o.geometry.computeBoundsTree();
    }
  })

  entity.setAttribute('uv-scroll', 'requireGltfExtension: true')
  entity.setAttribute('shadow', 'cast: true; receive: true')
};

async function addGlbReference(file, {loadingManager = undefined} = {}) {
  let id = shortid.generate()
  let asset = document.createElement('a-asset-item')
  asset.id = `asset-model-${id}`

  let loader = new THREE.GLTFLoader(loadingManager)

  let buffer = await file.arrayBuffer()
  let model = await new Promise((r, e) => loader.parse(buffer, "", r, e))


  let entity = document.createElement('a-entity')
  document.querySelector('#reference-spawn').append(entity)
  entity.setObject3D("mesh", model.scene || model.scenes[0])

  setupGlbReferenceEntity(entity)

  if (document.querySelector('a-scene').components['file-upload'].data.autoscaleModel)
  {
    Util.autoScaleViewer(entity.getObject3D('mesh'), entity)
    entity.object3D.position.z += 0.25
  }

  entity.emit('model-loaded', {format: 'gltf', model: model});

}


Util.registerComponentSystem('file-upload', {
  schema: {
    importMaterial: {default: true},
    combineMaterials: {default: true},
    autoscaleModel: {default: true},
    setMapFromFilename: {default: true},
    postProcessMesh: {default: true},
    replaceMesh: {default: true},
  },
  init() {
    this.importModelToMesh = importModelToMesh;
    this.fileInterceptors = []
    this.dragIndicator = document.querySelector('#drag-and-drop')
    this.dragSet = new Set()
    document.body.ondragover = (e) => {
      // console.log("Drag over", e.detail, e.target)
      e.preventDefault()
      if (this.dragIndicator)
      {
        this.dragIndicator.className = ""
      }
      this.dragSet.add(e.target)
    }

    document.body.ondragleave = (e) => {
      e.preventDefault()
      this.dragSet.delete(e.target)

      if (this.clearTimeout) {
        window.clearTimeout(this.clearTimeout)
      }

      this.clearTimeout = window.setTimeout(() => {
        if (this.dragSet.size === 0 && this.dragIndicator)
        {
          this.dragIndicator.className = "minimized"
        }
      }, 100)
      // console.log(e.target)
    }

    document.body.ondrop = (e) => {
      console.log("Drop", e.detail)
      e.preventDefault()
      if (this.dragIndicator) {
        this.dragIndicator.className = "minimized"
      }
      let referenceIdx = 0
      let items = Array.from(e.dataTransfer.items)

      for (let i = this.fileInterceptors.length - 1; i >= 0; i--)
      {
        if (this.fileInterceptors[i](items)) return;
      }

      if (items) {
        for (let item of items)
        {
          if (item.kind !== 'file') continue

          let file = item.getAsFile()

          console.log("dropping", item.type, item.kind, file.name)

          this.handleFile(file, {itemType: item.type})
        }
      }
      else {
        console.log("length", e.dataTransfer.files.length)
      }
    }

    document.onpaste = (event) => {
      console.log("Paste", event);
      var items = (event.clipboardData || event.originalEvent.clipboardData).items;
      for (let i = this.fileInterceptors.length - 1; i >= 0; i--)
      {
        if (this.fileInterceptors[i](items)) return;
      }
      if (items) {
        for (let item of items)
        {
          if (item.kind !== 'file') continue

          let file = item.getAsFile()

          console.log("dropping", item.type, item.kind, file.name)

          this.handleFile(file, {itemType: item.type})
        }
      }
    }

    this.inputEl = document.createElement('input')
    this.inputEl.setAttribute('type', "file")
    // this.inputEl.setAttribute('accept', ".vartiste")
    this.inputEl.style="display: none"
    this.inputEl.addEventListener('change', (e) => {this.handleBrowse(e)})
    document.body.append(this.inputEl)
  },
  handleFile(file, {itemType, positionIdx, loadingManager, busy, sceneName} = {}) {
    let settings = document.querySelector('a-scene').systems['settings-system']

    let isImage = itemType ? /image\//.test(itemType) : /\.(png|jpg|jpeg|bmp|svg)$/i.test(file.name)

    if (!busy) busy = this.el.systems['busy-indicator'].busy({title: `Handle ${file.name}`})

    if (/\.(mp4|mov|avi|m4v|webm|mkv|gif)$/.test(file.name))
    {
      if (settings.data.addReferences)
      {
        addMovieReference(file).then(() => busy.done())
      }
      else
      {
        addMovieLayer(file).then(() => busy.done())
      }
      return;
    }

    if (isImage)
    {
      if (settings.data.addReferences)
      {
        addImageReference(file).then(reference => {
          if (positionIdx === undefined) positionIdx = document.querySelectorAll('.reference-image').length
          reference.setAttribute('position', `${positionIdx * 0.1} 0 ${positionIdx * -0.02}`)
          busy.done()
        })
      }
      else
      {
        addImageLayer(file, {setMapFromFilename: this.data.setMapFromFilename}).then(() => busy.done())
      }
      return
    }

    if (/\.(hdri?|exr)$/i.test(file.name))
    {
      addHDRImage(file).then(busy.done())
      return
    }

    if (/\.materialpack$/i.test(file.name))
    {
      (async () => {
      let loader = new THREE.GLTFLoader(loadingManager)
      let buffer = await file.arrayBuffer()
      let model
      try {
        model = await new Promise((r, e) => loader.parse(buffer, "", r, e))
      }
      catch (e) {
        console.error("Could not load model", e)
        window.loadErrorBuffer = buffer
        return
      }
      settings.el.systems['material-pack-system'].addPacksFromObjects(model.scenes[0])

      busy.done()
      })()
      return
    }

    if (HANDLED_MODEL_FORMAT_REGEX.test(file.name))
    {
      if (settings.data.addReferences)
      {
        addGlbReference(file, {loadingManager}).then(() => busy.done())
      }
      else
      {
        addGlbViewer(file, {postProcessMesh: this.data.postProcessMesh, loadingManager, sceneName}).then(() => busy.done())
      }
      return
    }

    if (/\.(mtl)$/i.test(file.name))
    {
      busy.done()
      return
    }

    if (/\.(vartiste-brushes)$/i.test(file.name))
    {
      file.text().then(t => {
        this.el.sceneEl.systems['brush-system'].addUserBrushes(JSON.parse(t))
        busy.done()
      })
      return
    }

    if (/\.(vartiste-brushez)$/i.test(file.name))
    {
      file.arrayBuffer().then(b => {
        let inflated = Pako.inflate(b)
        let t = (new TextDecoder("utf-8")).decode(inflated)
        this.el.sceneEl.systems['brush-system'].addUserBrushes(JSON.parse(t))
        busy.done()
      })
      return
    }

    if (/\.zip$/i.test(file.name))
    {
      file.arrayBuffer().then(async (b) => {
        let zip = new JSZip();
        zip = await zip.loadAsync(b)
        console.log("New zip", zip)

        let blobs = {}
        let gltfFile = undefined

        for (let fileName in zip.files)
        {
          if (HANDLED_MODEL_FORMAT_REGEX.test(fileName)) gltfFile = fileName;

          console.log("Blobbing", fileName)
          let unzipped = await zip.file(fileName)
          if (!unzipped) continue;
          let blob = await unzipped.async('blob')
          blobs[fileName] = blob
          blob.name = fileName
        }

        const manager = new THREE.LoadingManager();
        // Initialize loading manager with URL callback.
        const objectURLs = [];
        let urlModifier = ( url ) => {
          let rawUrl = url;
          // if (url.startsWith("blob:") && !url.startsWith("blob:" + location.origin)) return url;
          if (url.startsWith('blob:http'))
          {
            let blobless = url.replace("blob:http", "http")
            console.log("Blobless", blobless)
            let u = new URL(blobless)
            url = u.pathname.slice(1)
          }

          if (url in blobs) {
            console.log("Modifying url", url, blobs[ url ])
          	url = URL.createObjectURL( blobs[ url ] );
          	objectURLs.push( url );
          	return url;
          }
          else
          {
            console.log("No blob for", url, rawUrl)
            return rawUrl
          }
        };
        manager.setURLModifier(urlModifier);
        if (gltfFile)
        {
          let blobFile = blobs[gltfFile];
          blobFile.name = gltfFile;

          this.handleFile(blobFile, {loadingManager: manager, sceneName: file.name.replace(/\.zip$/i, "")})
          busy.done()
          return;
        }

        let items = Object.values(blobs);

        for (let i = this.fileInterceptors.length - 1; i >= 0; i--)
        {
          if (this.fileInterceptors[i](items)) {
            busy.done();
            return;
          }
        }

        for (let blobFile of items)
        {
          this.handleFile(blobFile, {loadingManager: manager})
        }
        busy.done()
      })

      return;
    }

    if (/\.vartistez$/i.test(file.name))
    {
      file.arrayBuffer().then(b => {
        console.time('decompressProject')
        let inflated = Pako.inflate(b)
        inflated = (new TextDecoder("utf-8")).decode(inflated)
        console.timeEnd('decompressProject')
        settings.load(inflated)
        busy.done()
      })
      .catch(e => console.error("Couldn't load", e))
      return
    }

    if (/\.vartiste$/i.test(file.name))
    {
      file.text().then(t => {
        settings.load(t)
        busy.done()
      }).catch(e => console.error("Couldn't load", e))
      return;
    }

    console.warn("Unknown file", file.name)
  },
  handleURL(url, {positionIdx} = {}) {
    this.handleFile(new URLFileAdapter(url))
  },
  handleBrowse(e) {
    let items = Array.from(this.inputEl.files)
    console.log("browse items", items)

    for (let i = this.fileInterceptors.length - 1; i >= 0; i--)
    {
      if (this.fileInterceptors[i](items)) return;
    }

    for (let item of items)
    {
      this.handleFile(item, {itemType: item.type})
    }
  },
  browse() {
    this.inputEl.click()
  },
})

AFRAME.registerComponent('reference-glb', {
  events: {
    // object3dset: function(e) {
    //   let m = this.pool('inv', THREE.Matrix4)
    //   let box = Util.recursiveBoundingBox(this.el.getObject3D('mesh'))
    //   m.copy(this.el.object3D.matrixWorld).invert()
    //   box.applyMatrix4(m)
    //   box.getCenter(this.el.getObject3D('mesh').position)
    //   this.el.getObject3D('mesh').position.multiplyScalar(-1)
    // }
    bbuttondown: function (e) {
      if (this.el.is('grabbed'))
      {
        this.makeClone()
      }
    },
  },
  init() {
    Pool.init(this)
    this.el.classList.add('reference-glb')
    this.el.setAttribute('frame', 'closeable: true; autoHide: true; useBounds: true')
    this.el.setAttribute('action-tooltips', 'b: Clone')
    Util.whenComponentInitialized(this.el, 'frame', () => {
      let decomposeButton = this.el.components['frame'].addButton('#asset-close')
      decomposeButton.setAttribute('tooltip', 'Decompose to primitive constructs')
      decomposeButton.setAttribute('tooltip-style', this.el.components['frame'].data.tooltipStyle)
      decomposeButton.addEventListener('click', () => {
        this.el.sceneEl.systems['primitive-constructs'].decomposeReferences([this.el])
      })
    })
  },
  makeClone() {
    let el = document.createElement('a-entity')
    this.el.parentEl.append(el)
    Util.whenLoaded(el, () => {
      el.setObject3D('mesh', this.el.getObject3D('mesh').clone())
      el.setAttribute('reference-glb', this.data)
      Util.positionObject3DAtTarget(el.object3D, this.el.object3D)
    })
  }
})
