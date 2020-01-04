import {Layer} from './layer.js'

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
