import {THREED_MODES} from './layer-modes.js'
import {base64ArrayBuffer} from './framework/base64ArrayBuffer.js'
import {prepareModelForExport, bumpCanvasToNormalCanvas} from './material-transformations.js'
import {ProjectFile} from './project-file.js'
import {Undo} from './undo.js'
import {Util} from './util.js'

import {CanvasRecorder} from './canvas-recorder.js'
import Dexie from 'dexie'
Util.registerComponentSystem('settings-system', {
  schema: {
    addReferences: {default: false}
  },
  init() {
    console.log("Starting settings")
    this.projectName = "vartiste-project"
    this.quality = 1.0
    this.el.emit('projectnamechanged')
    this.mediumStabilizationAction()
    this.fullQualityAction()

    this.clipboardInput = document.createElement('input')
    document.body.append(this.clipboardInput)
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
  copyToClipboard(text, description) {
    this.clipboardInput.value = text
    this.clipboardInput.select();
    this.clipboardInput.setSelectionRange(0, 99999); /*For mobile devices*/

    document.execCommand("copy");

    this.el.emit('open-popup', `Attempted to copy ${description} to the clipboard!`)
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
  getPreview({width=64, height=64} = {}) {
    let compositor = Compositor.component
    let canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    canvas.getContext('2d').drawImage(compositor.preOverlayCanvas, 0, 0, width, height)
    return canvas.toDataURL()
  },
  openProjectsDB() {
    let db = new Dexie("project_database")
    db.version(1).stores({
      projects: 'name, modified',
      previews: 'name'
    });

    return db
  },
  async storeToBrowserAction() {
    let projectData = JSON.stringify(await ProjectFile.save({compositor: Compositor.component}))
    let db = this.openProjectsDB()
    await db.transaction("rw", db.projects, db.previews, async () => {
      await db.projects.put({
        name: this.projectName,
        projectData: projectData,
        modified: new Date(),
      })
      await db.previews.put({
        name: this.projectName,
        src: this.getPreview(),
      })
    })
    this.el.emit('open-popup', `Saved at ${new Date()}`)
    document.getElementById('composition-view').emit('updatemesh')
  },
  async loadFromBrowser(projectName) {
    let db = this.openProjectsDB()
    let project = await db.projects.get(projectName)
    this.load(project.projectData)
  },
  async deleteFromBrowser(projectName) {
    let db = this.openProjectsDB()
    await db.projects.delete(projectName)
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
  feedbackAction() {
    this.popup("https://forms.gle/SnNFFLyPve3kQc7Y9", "Feedback Survey")
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
    this.el.emit('qualitychanged', {quality: scale})
  },
  lowQualityAction() { this.setQuality(0.25) },
  mediumQualityAction() { this.setQuality(0.5) },
  fullQualityAction() { this.setQuality(1.0) },
  setStabilizeAmount(amount) {
    document.querySelectorAll('*[smooth-controller]').forEach((e) => e.setAttribute('smooth-controller', {amount}))
    this.el.emit('stabilizationchanged', {stabilization: amount})
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
  toggleUIAction() {
    let uiRoot = document.querySelector('#ui')
    uiRoot.setAttribute('visible', !uiRoot.getAttribute('visible'))
    document.querySelector('#unhide-ui').setAttribute('visible', !uiRoot.getAttribute('visible'))
    for (let el of document.querySelectorAll('*[raycaster]'))
    {
      el.components.raycaster.refreshObjects()
    }
  }
})
