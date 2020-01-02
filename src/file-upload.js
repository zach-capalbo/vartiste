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
