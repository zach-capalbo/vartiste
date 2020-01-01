AFRAME.registerSystem('settings-system', {
  init() {},
  popup(url, description) {
    this.el.emit('open-popup', description)
    window.open(url)
  },
  saveAction() {
    let saveImg = new Image()
    saveImg.src = document.getElementById('composite').toDataURL()
    saveImg.style = "z-index: 10000; position: absolute; top: 0px; left: 0px"
    document.body.append(saveImg)

    let popup = this.popup(saveImg.src, "Image to dowload")
  },
  helpAction() {
    this.popup("landing.html", "Instructions")
  }
})
