import {Layer} from './layer.js'
import shortid from 'shortid'
import {THREED_MODES} from './layer-modes.js'
import {RGBELoader} from './framework/RGBELoader.js'
import {Util} from './util.js'

class URLFileAdapter {
  constructor(url) {
    this.url = url
    this.name = url
  }
  async text() {
    let resp = await fetch(this.url)
    return await resp.text()
  }
}

function toSrcString(file) {
  if (file instanceof File) return URL.createObjectURL(file)
  if (file instanceof URLFileAdapter) return file.url
  return file
}

const MAP_FROM_FILENAME = {
  'multiply': [/AmbientOcclusion/i, /(\b|_)AO(map)?(\b|_)/i],
  'displacementMap': [/(\b|_)Disp(lacement)?(\b|_)/i],
  'normalMap': [/(\b|_)norm?(al)?(map)?(\b|_)/i],
  'emissiveMap': [/(\b|_)emi(t|tion|ssive|ss)?(map)?(\b|_)/i],
  'metalnessMap': [/(\b|_)metal(ness|ic)?(map)?(\b|_)/i],
  'roughnessMap': [/(\b|_)rough(ness)?(map)?(\b|_)/i],
  'matcap': [/(\b|_)matcap(\b|_)/i]
}

async function addImageLayer(file, {setMapFromFilename = false} = {}) {
  let image = new Image()
  image.src = toSrcString(file)
  image.id = "img"

  await new Promise((r,e) => image.onload = r)
  image.onload = undefined

  let layer = new Layer(image.width, image.height)
  layer.canvas.getContext('2d').drawImage(image, 0, 0)

  if (file.name && setMapFromFilename)
  {
    for (let map in MAP_FROM_FILENAME)
    {
      if (MAP_FROM_FILENAME[map].some(exp => exp.test(file.name)))
      {
        layer.mode = map
        break;
      }
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
  viewer.setAttribute('frame', 'closable: true')
  viewer.classList.add("clickable")
  viewer.classList.add("reference-image")
  document.querySelector('#reference-spawn').append(viewer)
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

async function addGlbViewer(file, {postProcessMesh = true} = {}) {
  let id = shortid.generate()
  let asset = document.createElement('a-asset-item')
  asset.id = `asset-model-${id}`

  let compositor = Compositor.component
  let {combineMaterials, importMaterial, replaceMesh} = compositor.el.sceneEl.components['file-upload'].data

  if (document.querySelector('a-scene').systems['settings-system'].projectName === 'vartiste-project')
  {
    document.querySelector('a-scene').systems['settings-system'].setProjectName(file.name.replace(/\.(glb|obj|vrm)$/i, ""))
  }

  let startingLayerLength = compositor.layers.length

  let startingLayer = compositor.activeLayer

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
    let loader = new THREE.OBJLoader()
    model = new THREE.Object3D()
    let buffer = await file.text()
    model.scene = loader.parse(buffer)
    model.add(model.scene)
  }
  else if (format === 'fbx')
  {
    const { FBXLoader } = await import('./framework/FBXLoader.js')
    let loader = new FBXLoader()
    let buffer = await file.arrayBuffer()
    model = new THREE.Object3D()
    model.scene = loader.parse(buffer)
    model.add(model.scene)
  }
  else
  {
    let loader = new THREE.GLTFLoader()
    let buffer = await file.arrayBuffer()
    model = await new Promise((r, e) => loader.parse(buffer, "", r, e))
  }

  console.log("loaded", model)

  let materials = {}

  let materialId = (material) => material.map ? material.map.uuid : material.uuid;

  model.scene.traverse(o => {
    if (o.geometry) {
      Util.deinterleaveAttributes(o.geometry)

      if (postProcessMesh && o.geometry.index)
      {
        o.geometry = o.geometry.toNonIndexed()
      }
    }
  })

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
          if (mode === 'roughnessMap' || mode === 'metalnessMap' || mode === 'emissiveMap') shouldUse3D = true
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

          if (image)
          {
            layerCtx.translate(width / 2, height / 2)
            try {
              layerCtx.drawImage(image, -width / 2, -height / 2, width, height)
              layerCtx.fillStyle = material.color.convertLinearToSRGB().getStyle()
              layerCtx.globalCompositeOperation = 'multiply'
              layerCtx.fillRect( -width / 2, -height / 2, width, height)
              layerCtx.globalCompositeOperation = 'destination-in'
              layerCtx.drawImage(image, -width / 2, -height / 2, width, height)
              layerCtx.globalCompositeOperation = 'source-over'
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

            for (let i = 0; i < attr.count; ++i)
            {
              attr.setXY(i,
                THREE.Math.mapLinear(attr.getX(i) % 1.00000000000001, 0, 1, currentBox.min.x, currentBox.max.x),
                THREE.Math.mapLinear(attr.getY(i) % 1.00000000000001, 0, 1, currentBox.min.y, currentBox.max.y))
            }

            adjustedArrays.add(attr.data)
          }
          else
          {
            if (adjustedArrays.has(geometry.attributes.uv.array)) return;

            let indices = {has: function() { return true; }}
            if (geometry.index)
            {
              indices = new Set(geometry.index.array)
            }

            for (let i in geometry.attributes.uv.array) {
              if (!indices.has(Math.floor(i / 2))) continue;

              if (i %2 == 0) {
                attr.array[i] = THREE.Math.mapLinear(attr.array[i] % 1.00000000000001, 0, 1, currentBox.min.x, currentBox.max.x)
              }
              else
              {
                attr.array[i] = THREE.Math.mapLinear(attr.array[i] % 1.00000000000001, 0, 1, currentBox.min.y, currentBox.max.y)
              }
            }

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
        compositor.el.sceneEl.systems['mesh-tools'].bakeVertexColorsToTexture()
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

    compositor.activateLayer(startingLayer);
  })()
}

async function addGlbReference(file) {
  let id = shortid.generate()
  let asset = document.createElement('a-asset-item')
  asset.id = `asset-model-${id}`

  let loader = new THREE.GLTFLoader()

  let buffer = await file.arrayBuffer()
  let model = await new Promise((r, e) => loader.parse(buffer, "", r, e))


  let entity = document.createElement('a-entity')
  document.querySelector('#reference-spawn').append(entity)
  entity.classList.add("clickable")
  entity.classList.add("reference-glb")
  entity.setObject3D("mesh", model.scene || model.scenes[0])

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

  entity.setAttribute('uv-scroll', 'requireGltfExtension: true')

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
    document.body.ondragover = (e) => {
      // console.log("Drag over", e.detail)
      e.preventDefault()
    }

    document.body.ondrop = (e) => {
      console.log("Drop", e.detail)
      e.preventDefault()
      let referenceIdx = 0

      if (e.dataTransfer.items) {
        for (let item of e.dataTransfer.items)
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
  },
  handleFile(file, {itemType, positionIdx} = {}) {
    let settings = document.querySelector('a-scene').systems['settings-system']

    let isImage = itemType ? /image\//.test(itemType) : /\.(png|jpg|jpeg|bmp|svg)$/i.test(file.name)

    if (isImage)
    {
      if (settings.data.addReferences)
      {
        addImageReference(file).then(reference => {
          if (positionIdx === undefined) positionIdx = document.querySelectorAll('.reference-image').length
          reference.setAttribute('position', `${positionIdx * 0.1} 0 ${positionIdx * -0.02}`)
        })
      }
      else
      {
        addImageLayer(file, {setMapFromFilename: this.data.setMapFromFilename})
      }
      return
    }

    if (/\.(hdri?|exr)$/i.test(file.name))
    {
      addHDRImage(file)
      return
    }

    if (/\.(glb)|(gltf)|(obj)|(fbx)|(vrm)$/i.test(file.name))
    {
      if (settings.data.addReferences)
      {
        addGlbReference(file)
      }
      else
      {
        addGlbViewer(file, {postProcessMesh: this.data.postProcessMesh})
      }
      return
    }

    if (/\.(mtl)$/i.test(file.name))
    {
      return
    }

    file.text().then(t => {
      console.log("Texted")
      settings.load(t)
    }).catch(e => console.error("Couldn't load", e))
  },
  handleURL(url, {positionIdx} = {}) {
    this.handleFile(new URLFileAdapter(url))
  },
})
