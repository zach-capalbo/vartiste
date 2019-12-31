AFRAME.registerSystem('settings-system', {
  init() {},
  saveAction() {
    let saveImg = new Image()
    saveImg.src = document.getElementById('composite').toDataURL()
    saveImg.style = "z-index: 10000; position: absolute; top: 0px; left: 0px"
    document.body.append(saveImg)

    let popup = window.open(saveImg.src, "_blank")
  }
})
