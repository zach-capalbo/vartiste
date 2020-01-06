import {Layer} from './layer.js'
import shortid from 'shortid'

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

  let viewer = document.getElementById('composition-view')
  viewer.setObject3D('mesh', model.scene || model.scenes[0])
  viewer.setAttribute('composition-viewer', 'compositor: #canvas-view')

  let mainCanvas = document.getElementById('canvas-view')
  mainCanvas.setAttribute("position", "0 0.6 3.14")
  mainCanvas.setAttribute("rotation", "0 180 0")
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
