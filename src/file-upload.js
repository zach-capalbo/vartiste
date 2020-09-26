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

async function addImageLayer(file) {
  let image = new Image()
  image.src = toSrcString(file)
  image.id = "img"

  await new Promise((r,e) => image.onload = r)
  image.onload = undefined

  let layer = new Layer(image.width, image.height)
  layer.canvas.getContext('2d').drawImage(image, 0, 0)

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

async function addGlbViewer(file) {
  let id = shortid.generate()
  let asset = document.createElement('a-asset-item')
  asset.id = `asset-model-${id}`

  if (document.querySelector('a-scene').systems['settings-system'].projectName === 'vartiste-project')
  {
    document.querySelector('a-scene').systems['settings-system'].setProjectName(file.name.replace(/\.glb$/i, ""))
  }

  let loader = new THREE.GLTFLoader()

  let buffer = await file.arrayBuffer()
  let model = await new Promise((r, e) => loader.parse(buffer, "", r, e))

  let materials = {}

  model.scene.traverse(o => {
    if (o.material)
    {
      materials[o.material.uuid] = o.material
    }
  })

  let compositor = document.getElementById('canvas-view').components.compositor

  compositor.el.setAttribute('compositor', {wrapTexture: true})

  for (let material of Object.values(materials))
  {
    for (let mode of ["map"].concat(THREED_MODES))
    {
      if (material[mode])
      {
        let image = material[mode].image
        let {width, height} = compositor
        let layer = new Layer(width, height)
        let layerCtx = layer.canvas.getContext('2d')
        layerCtx.save()
        layerCtx.translate(width / 2, height / 2)
        //layerCtx.scale(1, -1)
        layerCtx.drawImage(image, -width / 2, -height / 2, width, height)
        layerCtx.restore()
        if (mode !== "map")
        {
          layer.mode = mode
        }
        compositor.addLayer(compositor.layers.length - 1, {layer})
      }
    }
  }

  document.getElementsByTagName('a-scene')[0].systems['settings-system'].addModelView(model)
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
  entity.emit('model-loaded', {format: 'gltf', model: model});

}


Util.registerComponentSystem('file-upload', {
  schema: {

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
        addImageLayer(file)
      }
      return
    }

    if (/\.(hdri?|exr)$/i.test(file.name))
    {
      addHDRImage(file)
      return
    }

    if (/\.(glb)|(gltf)$/i.test(file.name))
    {
      if (settings.data.addReferences)
      {
        addGlbReference(file)
      }
      else
      {
        addGlbViewer(file)
      }
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
