import {THREED_MODES} from './layer-modes.js'
import {base64ArrayBuffer} from './framework/base64ArrayBuffer.js'
import {prepareModelForExport, bumpCanvasToNormalCanvas} from './material-transformations.js'
import {ProjectFile} from './project-file.js'
import {Undo} from './undo.js'
import {Environments} from './environments.js'
import {CanvasRecorder} from './canvas-recorder.js'
AFRAME.registerSystem('settings-system', {
  schema: {
    addReferences: {default: false}
  },
  init() {
    this.projectName = "vartiste-project"
    this.quality = 1.0
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

    if (typeof filename !== 'string') filename = this.makeFileName(filename)

    let desktopLink = document.createElement('a')
    desktopLink.href = url
    desktopLink.style = "z-index: 10000; position: absolute; top: 50%; left: 50%; padding: 5px; background-color: #eee; transform: translate(-50%,-50%)"
    desktopLink.innerHTML = "Open " + description
    desktopLink.download = filename
    // document.body.append(desktopLink)

    desktopLink.click()
  },
  makeFileName({extension = "", suffix}) {
    if (suffix) suffix = `-${suffix}`
    return `${this.projectName}-${this.formatFileDate()}${suffix}.${extension}`
  },
  exportAction({suffix = ""} = {}) {
    let compositor = document.getElementById('canvas-view').components.compositor;

    let saveImg = new Image()
    saveImg.src = compositor.preOverlayCanvas.toDataURL()
    saveImg.style = "z-index: 10000; position: absolute; top: 0px; left: 0px"

    if (suffix) suffix = `-${suffix}`

    this.download(saveImg.src, `${this.projectName}-${this.formatFileDate()}${suffix}.png`, "Canvas Images")

    if (compositor.data.useNodes)
    {
      for (let mode of THREED_MODES)
      {
        if (Compositor.material[mode] && Compositor.material[mode].image)
        {
          this.download(Compositor.material[mode].image.toDataURL(), `${this.projectName}-${this.formatFileDate()}${suffix}-${mode}.png`, mode)
        }
      }
    }
    else
    {
      for (let mode of THREED_MODES)
      {
        for (let layer of compositor.layers)
        {
          if (layer.mode !== mode) continue

          this.download(layer.canvas.toDataURL(), `${this.projectName}-${this.formatFileDate()}${suffix}-${mode}.png`, mode)
        }
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
  async getExportableGLB(exportMesh) {
    let mesh = exportMesh || Compositor.meshRoot
    let material = document.getElementById('canvas-view').getObject3D('mesh').material
    let originalImage = material.map.image
    material.map.image = Compositor.component.preOverlayCanvas
    material.map.needsUpdate = true
    prepareModelForExport(mesh, material)

    let exporter = new THREE.GLTFExporter()
    let glb = await new Promise((r, e) => {
      exporter.parse(mesh, r, {binary: true, animations: mesh.animations || []})
    })

    material.map.image = originalImage
    material.map.needsUpdate = true

    return glb
  },
  async export3dAction(exportMesh) {
    let glb = await this.getExportableGLB(exportMesh)

    this.download("data:application:/x-binary;base64," + base64ArrayBuffer(glb), `${this.projectName}-${this.formatFileDate()}.glb`, "GLB File")

    document.getElementById('composition-view').emit('updatemesh')
  },
  async exportSketchfabAction() {
    if (this.el.systems.sketchfab.loggedIn())
    {
      this.el.systems.sketchfab.upload()
    }
    else
    {
      this.el.systems.sketchfab.login()
    }
  },
  async recordAction() {
    let compositor = document.getElementById('canvas-view').components.compositor
    if (!this.compositeRecorder)
    {
      this.compositeRecorder = new CanvasRecorder({canvas: compositor.preOverlayCanvas, frameRate: compositor.data.frameRate})
      compositor.data.drawOverlay = false
      this.compositeRecorder.start()
    }
    else
    {
      await this.compositeRecorder.stop()
      this.download(this.compositeRecorder.createURL(), `${this.projectName}-${this.formatFileDate()}.webm`, "Video Recording")
      compositor.data.drawOverlay = true
      delete this.compositeRecorder
    }
  },
  addModelView(model) {
    let viewer = document.getElementById('composition-view')
    viewer.setObject3D('mesh', model.scene || model.scenes[0])
    viewer.setAttribute('composition-viewer', 'compositor: #canvas-view')

    let mainCanvas = document.getElementById('canvas-view')
    mainCanvas.setAttribute("position", "0 0.6 3.14")
    mainCanvas.setAttribute("rotation", "0 180 0")
  },
  async load(text) {
    let loadObj = JSON.parse(text)
    await ProjectFile.load(loadObj, {compositor: document.getElementById('canvas-view').components.compositor})
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
    this.quality = scale
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
  },
  changeEnvironmentAction() {
    Environments.toggle()
  }
})
