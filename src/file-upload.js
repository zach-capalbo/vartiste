import {Layer} from './layer.js'
import shortid from 'shortid'
import {THREED_MODES} from './layer-modes.js'

async function addImageLayer(file) {
  let image = new Image()
  image.src = URL.createObjectURL(file)
  image.id = "img"

  await new Promise((r,e) => image.onload = r)
  image.onload = undefined

  let layer = new Layer(image.width, image.height)
  layer.canvas.getContext('2d').drawImage(image, 0, 0)

  let compositor = document.getElementById('canvas-view').components.compositor
  compositor.addLayer(compositor.layers.length - 1, {layer})
}

async function addGlbViewer(file) {
  let id = shortid.generate()
  let asset = document.createElement('a-asset-item')
  asset.id = `asset-model-${id}`

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

  for (let material of Object.values(materials))
  {
    for (let mode of ["map"].concat(THREED_MODES))
    {
      if (material[mode])
      {
        if (mode === "normalMap") continue
        let image = material[mode].image
        let {width, height} = compositor
        let layer = new Layer(width, height)
        let layerCtx = layer.canvas.getContext('2d')
        layerCtx.save()
        layerCtx.translate(width / 2, height / 2)
        layerCtx.scale(1, -1)
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

document.body.ondragover = (e) => {
  console.log("Drag over", e.detail)
  e.preventDefault()
}

document.body.ondrop = (e) => {
  console.log("Drop", e.detail)
  e.preventDefault()

  if (e.dataTransfer.items) {
    for (let item of e.dataTransfer.items)
    {
      if (item.kind !== 'file') continue

      console.log("dropping", item)

      let file = item.getAsFile()

      if (/image\//.test(item.type))
      {
        addImageLayer(file)
        return
      }

      if (/\.(glb)|(gltf)$/i.test(file.name))
      {
        addGlbViewer(file)
        return
      }

      file.text().then(t => {
        console.log("Texted")
        document.querySelector('a-scene').systems['settings-system'].load(t)
      }).catch(e => console.error("Couldn't load", e))
    }
  }
  else {
    console.log("length", e.dataTransfer.files.length)
  }
}
