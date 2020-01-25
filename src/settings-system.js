import {THREED_MODES} from './layer-modes.js'
import {base64ArrayBuffer} from './framework/base64ArrayBuffer.js'
import {prepareModelForExport} from './material-transformations.js'
import {ProjectFile} from './project-file.js'
import {Undo} from './undo.js'
import {Environments} from './environments.js'
AFRAME.registerSystem('settings-system', {
  init() {
    this.projectName = "vartiste-project"
  },
  popup(url, description) {
    this.el.emit('open-popup', `Attempted to open a poup for ${description}. You may need to take off your headset to view it. You may also need to disable your popup blocker.`)
    window.open(url)

    let desktopLink = document.createElement('a')
    desktopLink.href = url
    desktopLink.style = "z-index: 10000; position: absolute; top: 50%; left: 50%; padding: 5px; background-color: #eee; transform: translate(-50%,-50%)"
    desktopLink.innerHTML = "Open " + description
    // document.body.append(desktopLink)
  },
  download(url, filename, description) {
    this.el.emit('open-popup', `Attempted to download the ${description}. You may need to take off your headset to download it.`)

    let desktopLink = document.createElement('a')
    desktopLink.href = url
    desktopLink.style = "z-index: 10000; position: absolute; top: 50%; left: 50%; padding: 5px; background-color: #eee; transform: translate(-50%,-50%)"
    desktopLink.innerHTML = "Open " + description
    desktopLink.download = filename
    // document.body.append(desktopLink)

    desktopLink.click()
  },
  exportAction() {
    let compositor = document.getElementById('canvas-view').components.compositor;

    let saveImg = new Image()
    saveImg.src = compositor.compositeCanvas.toDataURL()
    saveImg.style = "z-index: 10000; position: absolute; top: 0px; left: 0px"

    this.download(saveImg.src, `${this.projectName}-${this.formatFileDate()}.png`, "Canvas Images")

    for (let mode of THREED_MODES)
    {
      for (let layer of compositor.layers)
      {
        if (layer.mode !== mode) continue

        this.download(layer.canvas.toDataURL(), `${this.projectName}-${this.formatFileDate()}-${mode}.png`, mode)
      }
    }
  },
  async saveAction() {
    let compositor = document.getElementById('canvas-view').components.compositor;
    let saveObj = await ProjectFile.save({compositor})
    let encoded = encodeURIComponent(JSON.stringify(saveObj))

    this.download("data:application/x-binary," + encoded, `${this.projectName}-${this.formatFileDate()}.vartiste`, "Project File")

    document.getElementById('composition-view').emit('updatemesh')
  },
  async export3dAction() {
    let mesh = document.getElementById('composition-view').getObject3D('mesh') || document.getElementById('canvas-view').getObject3D('mesh')
    let material = document.getElementById('canvas-view').getObject3D('mesh').material
    prepareModelForExport(mesh, material)

    let exporter = new THREE.GLTFExporter()
    let glb = await new Promise((r, e) => {
      exporter.parse(mesh, r, {binary: true})
    })

    this.download("data:application:/x-binary;base64," + base64ArrayBuffer(glb), `${this.projectName}-${this.formatFileDate()}.glb`, "GLB File")

    document.getElementById('composition-view').emit('updatemesh')
  },
  addModelView(model) {
    let viewer = document.getElementById('composition-view')
    viewer.setObject3D('mesh', model.scene || model.scenes[0])
    viewer.setAttribute('composition-viewer', 'compositor: #canvas-view')

    let mainCanvas = document.getElementById('canvas-view')
    mainCanvas.setAttribute("position", "0 0.6 3.14")
    mainCanvas.setAttribute("rotation", "0 180 0")
  },
  load(text) {
    let loadObj = JSON.parse(text)
    ProjectFile.load(loadObj, {compositor: document.getElementById('canvas-view').components.compositor})
  },
  helpAction() {
    this.popup("landing.html", "Instructions")
  },
  formatFileDate() {
    let date = new Date()
    return date.toJSON().split(":")[0]
  },
  resetCameraAction() {
    let cameraRoot = document.getElementById('camera-root').object3D
    let camera = document.getElementById('camera').object3D

    cameraRoot.position.x = -camera.position.x
    cameraRoot.position.z = -camera.position.z
    cameraRoot.position.y = -camera.position.y + 1.23

    cameraRoot.rotation.y = -camera.rotation.y
  },
  setQuality(scale) {
    document.getElementById('canvas-view').setAttribute('compositor', {textureScale: scale})
  },
  lowQualityAction() { this.setQuality(0.25) },
  mediumQualityAction() { this.setQuality(0.5) },
  fullQualityAction() { this.setQuality(1.0) },
  setStabilizeAmount(amount) {
    document.querySelectorAll('*[smooth-controller]').forEach((e) => e.setAttribute('smooth-controller', {amount}))
  },
  noStabilizationAction() { this.setStabilizeAmount(1) },
  mediumStabilizationAction() { this.setStabilizeAmount(4) },
  maxStabilizationAction() { this.setStabilizeAmount(12) },
  undoAction() {
    Undo.undo()
  },
  toggleUndoAction() {
    Undo.enabled = !Undo.enabled
  },
  setProjectName(name) {
    this.projectName = name
    this.el.emit('projectnamechanged', {name})
  }
})
