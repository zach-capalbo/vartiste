AFRAME.registerSystem('settings-system', {
  init() {},
  popup(url, description) {
    this.el.emit('open-popup', description)
    window.open(url)

    let desktopLink = document.createElement('a')
    desktopLink.href = url
    desktopLink.style = "z-index: 10000; position: absolute; top: 50%; left: 50%; padding: 5px; background-color: #eee; transform: translate(-50%,-50%)"
    desktopLink.innerHTML = "Open " + description
    document.body.append(desktopLink)
  },
  download(url, filename, description) {
    this.el.emit('open-popup', description)

    let desktopLink = document.createElement('a')
    desktopLink.href = url
    desktopLink.style = "z-index: 10000; position: absolute; top: 50%; left: 50%; padding: 5px; background-color: #eee; transform: translate(-50%,-50%)"
    desktopLink.innerHTML = "Open " + description
    desktopLink.download = filename
    document.body.append(desktopLink)

    desktopLink.click()
  },
  exportAction() {
    let saveImg = new Image()
    saveImg.src = document.getElementById('composite').toDataURL()
    saveImg.style = "z-index: 10000; position: absolute; top: 0px; left: 0px"


    this.download(saveImg.src, `VARTISTE-${this.formatFileDate()}.png`, "Image to dowload")
  },
  saveAction() {
    let compositor = document.getElementById('canvas-view').components.compositor;
    let saveObj = compositor.save()
    let encoded = encodeURIComponent(JSON.stringify(saveObj))

    this.download("data:application/x-binary," + encoded, `project-${this.formatFileDate()}.vartiste`, "Project File")
  },
  load(text) {
    let loadObj = JSON.parse(text)

    let compositor = document.getElementById('canvas-view').components.compositor;
    compositor.load(loadObj)
  },
  helpAction() {
    this.popup("landing.html", "Instructions")
  },
  formatFileDate() {
    let date = new Date()
    return date.toJSON().split(":")[0]
  }
})
