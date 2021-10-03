import {THREED_MODES} from './layer-modes.js'
import {base64ArrayBuffer} from './framework/base64ArrayBuffer.js'
import {prepareModelForExport} from './material-transformations.js'
import {ProjectFile} from './project-file.js'
import {Undo, UndoStack} from './undo.js'
import {Util} from './util.js'
import {Pool} from './pool.js'
import Pako from 'pako'
import CompressionWorker from './compression.worker.js'

window.CompressionWorker = CompressionWorker

import {CanvasRecorder} from './canvas-recorder.js'
import Dexie from 'dexie'
Util.registerComponentSystem('settings-system', {
  schema: {
    addReferences: {default: false},
    exportJPEG: {default: false},
    compressProject: {default: true},
  },
  events: {
    startcanvasdrawing: function(e) {
      if (!this.el.systems['low-power'].isLowPower()) return;
      console.log("startdraw", e)
      let uiRoot = this.uiRoot || document.querySelector('#ui')
      this.uiRoot = uiRoot
      this.wasUIShown = uiRoot.getAttribute('visible')
      if (this.wasUIShown)
      {
        uiRoot.setAttribute('visible', false)
      }
    },
    enddrawing: function(e) {
      if (!this.el.systems['low-power'].isLowPower()) return;
      let uiRoot = this.uiRoot || document.querySelector('#ui')
      this.uiRoot = uiRoot
      if (this.wasUIShown)
      {
        uiRoot.setAttribute('visible', true)
      }
      delete this.wasUIShown
    }
  },
  init() {
    console.log("Starting settings")
    this.projectName = "vartiste-project"
    this.quality = 1.0
    this.el.emit('projectnamechanged')
    this.mediumStabilizationAction()
    this.fullQualityAction()
    Pool.init(this)

    this.clipboardInput = document.createElement('input')
    document.body.append(this.clipboardInput)

    this.saveAction = Util.busify({title: "Saving..."}, this.saveAction, this)
    this.storeToBrowserAction = Util.busify({title: "Saving..."}, this.storeToBrowserAction, this)
    this.loadFromBrowser = Util.busify({title: "Loading..."}, this.loadFromBrowser, this)
    this.export3dAction = Util.busify({title: "Exporting..."}, this.export3dAction, this)
    this.load = Util.busify({title: "Loading..."}, this.load, this)
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
  async downloadCompressed(rawData, filename, description) {
    let busy = this.el.sceneEl.systems['busy-indicator'].busy({title: description})

    let data
    let worker = new CompressionWorker();
    try {
      data = await new Promise((r, e) => {
        worker.onmessage = (message) => {
          r(message.data)
        }
        worker.onerror = e;
        worker.postMessage(rawData)
      })
    }
    finally
    {
      worker.terminate();
    }

    this.download("data:application/x-binary;base64," + base64ArrayBuffer(data), filename, description)
    busy.done()
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
  imageURLType(canvas) {
    if (!canvas) return this.data.exportJPEG ? "image/jpeg" : "image/png"
    if (this.data.exportJPEG) return Util.isCanvasFullyOpaque(canvas) ? "image/jpeg" : "image/png"
    return "image/png"
  },
  compressionQuality() {
    return this.data.exportJPEG ? 0.85 : undefined;
  },
  imageExtension() {
    return this.data.exportJPEG ? "jpg" : "png"
  },
  exportAction({suffix = ""} = {}) {
    let compositor = document.getElementById('canvas-view').components.compositor;

    let saveImg = new Image()
    saveImg.src = compositor.preOverlayCanvas.toDataURL(this.imageURLType(), this.compressionQuality())
    saveImg.style = "z-index: 10000; position: absolute; top: 0px; left: 0px"

    if (suffix) suffix = `-${suffix}`

    this.download(saveImg.src, `${this.projectName}-${this.formatFileDate()}${suffix}.${this.imageExtension()}`, "Canvas Images")

    if (compositor.data.useNodes)
    {
      for (let mode of THREED_MODES)
      {
        if (Compositor.material[mode] && Compositor.material[mode].image)
        {
          this.download(Compositor.material[mode].image.toDataURL(this.imageURLType(), this.compressionQuality()), `${this.projectName}-${this.formatFileDate()}${suffix}-${mode}.${this.imageExtension()}`, mode)
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

          this.download(layer.canvas.toDataURL(this.imageURLType(), this.compressionQuality()), `${this.projectName}-${this.formatFileDate()}${suffix}-${mode}.${this.imageExtension()}`, mode)
        }
      }
    }
  },
  async saveAction() {
    let compositor = document.getElementById('canvas-view').components.compositor;
    let saveObj = await ProjectFile.save({compositor})
    let compositionView = document.getElementById('composition-view')
    if (compositionView) {
      compositionView.emit('updatemesh')
    }

    let json = JSON.stringify(saveObj)
    if (this.data.compressProject)
    {
      console.time('compressProject')
      let data
      let worker = new CompressionWorker();
      try {
        data = await new Promise((r, e) => {
          worker.onmessage = (message) => {
            r(message.data)
          }
          worker.onerror = e;
          worker.postMessage(json)
        })
      }
      finally
      {
        worker.terminate();
      }
      console.timeEnd('compressProject')
      this.download("data:application/x-binary;base64," + base64ArrayBuffer(data), `${this.projectName}-${this.formatFileDate()}.vartistez`, "Project File")
    }
    else
    {
      let encoded = encodeURIComponent(json)
      this.download("data:application/x-binary," + encoded, `${this.projectName}-${this.formatFileDate()}.vartiste`, "Project File")
    }
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
  async getExportableGLB(exportMesh, {undoStack} = {}) {
    let mesh = exportMesh;
    let material = mesh.material || Compositor.material
    let originalImage
    if (!mesh) {
      mesh = Compositor.meshRoot
      material = Compositor.material
      originalImage = material.map.image
      material.map.image = Compositor.component.preOverlayCanvas
      material.map.needsUpdate = true
    }

    // Need to traverse to get all materials
    mesh.traverseVisible(m => {
      if (m.geometry || m.material)
      {
        prepareModelForExport(m, m.material, {undoStack})
      }
    })


    function postProcessJSON(outputJSON) {
      if (!outputJSON.extensions) outputJSON.extensions = {}

      AFRAME.utils.extendDeep(outputJSON.extensions, mesh.userData.gltfExtensions)
    }

    let exporter = new THREE.GLTFExporter()
    let glb = await new Promise((r, e) => {
      exporter.parse(mesh, r, {binary: true, animations: mesh.animations || [], includeCustomExtensions: true, mimeType: this.imageURLType(), imageQuality: this.compressionQuality(), postProcessJSON})
    })

    if (material.map && originalImage)
    {
      material.map.image = originalImage
      material.map.needsUpdate = true
    }

    return glb
  },
  async export3dAction(exportMesh) {
    if (!exportMesh) exportMesh = Compositor.meshRoot
    let undoStack = new UndoStack({maxSize: -1})
    let glb = await this.getExportableGLB(exportMesh, {undoStack})
    let extension = "glb"

    if (exportMesh.userData && exportMesh.userData.gltfExtensions && exportMesh.userData.gltfExtensions.VRM)
    {
      extension = 'vrm'
    }

    this.download("data:application:/x-binary;base64," + base64ArrayBuffer(glb), `${this.projectName}-${this.formatFileDate()}.${extension}`, "GLB File")

    while (undoStack.stack.length)
    {
      undoStack.undo()
    }

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
  addModelView(model, {replace = true, forceAutoScale = undefined, undo = true} = {}) {
    let viewer = document.getElementById('composition-view')

    let rootObj = model.scene || model.scenes[0]

    if (!viewer.getObject3D('mesh')) replace = true

    if (forceAutoScale || (this.el.sceneEl.components['file-upload'].data.autoscaleModel && replace))
    {
      Util.autoScaleViewer(rootObj, viewer)
    }

    viewer.setAttribute('shadow', 'cast: true; receive: true')

    if (undo) {
      let oldObject = viewer.getObject3D('mesh')
      Undo.collect(() => {
          Undo.pushObjectMatrix(Compositor.el.object3D)
          Undo.push(() => {
            let o = model.scene || model.scenes[0]
            if (!replace)
            {
            }
            else if (oldObject)
            {
              viewer.setObject3D('mesh', oldObject)
            }
            else
            {
              delete viewer.object3DMap.mesh
            }
            o.parent.remove(o)
          })
      })
    }

    if (replace)
    {
      viewer.setObject3D('mesh', model.scene || model.scenes[0])
    }
    else
    {
      let scene = model.scene || model.scenes[0]
      scene.el = viewer
      scene.traverse(o => o.el = viewer)
      Compositor.meshRoot.add(scene)
      Compositor._cachedMeshesMesh = null
      viewer.emit('updatemesh')
    }

    viewer.setAttribute('composition-viewer', 'compositor: #canvas-view')
    Compositor.el.setAttribute('compositor', {wrapTexture: true})

    rootObj.traverse(o => {
      if (o.geometry && o.geometry.attributes.position && o.geometry.attributes.position.count > 6) {
        o.geometry.computeBoundsTree();
      }
    })

    let mainCanvas = Compositor.el
    // mainCanvas.setAttribute("position", "0 0.6 3.14")
    // mainCanvas.setAttribute("rotation", "0 180 0")
    mainCanvas.setAttribute('position', "-0.33131340738157977 0.6952806276999972 0.33044786242701646")
    mainCanvas.setAttribute('rotation', "-24.590389275038515 35.81312512886439 1.0193681034761404")
    mainCanvas.setAttribute('scale', "0.002 0.002 0.002")
  },
  async load(text) {
    window.isLoadingProject = true
    let loadObj = JSON.parse(text)
    await ProjectFile.load(loadObj, {compositor: document.getElementById('canvas-view').components.compositor})
    window.isLoadingProject = false
    window.loadedSuccessfully = true
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
  setQuality(scale) {
    Compositor.el.setAttribute('compositor', {textureScale: scale})
    this.quality = scale
    this.el.emit('qualitychanged', {quality: scale})
  },
  lowQualityAction() { this.setQuality(0.25) },
  mediumQualityAction() { this.setQuality(0.5) },
  fullQualityAction() { this.setQuality(1.0) },
  setStabilizeAmount(amount) {
    document.querySelectorAll('*[smoothed-webxr-motion-controller]').forEach((e) => e.setAttribute('smoothed-webxr-motion-controller', {amount}))
    this.el.emit('stabilizationchanged', {stabilization: amount})
  },
  noStabilizationAction() { this.setStabilizeAmount(0) },
  mediumStabilizationAction() { this.setStabilizeAmount(0.8) },
  maxStabilizationAction() { this.setStabilizeAmount(0.95) },
  undoAction() {
    Undo.undo()
  },
  toggleUndoAction() {
    Undo.enabled = !Undo.enabled
  },
  setProjectName(name) {
    this.projectName = name
    this.hasSetProjectName = true
    this.el.emit('projectnamechanged', {name})
  },
  toggleUIAction() {
    let uiRoot = this.uiRoot || document.querySelector('#ui')
    this.uiRoot = uiRoot
    uiRoot.setAttribute('visible', !uiRoot.getAttribute('visible'))
    //document.querySelector('#unhide-ui').setAttribute('visible', !uiRoot.getAttribute('visible'))
    for (let el of document.querySelectorAll('*[raycaster]'))
    {
      el.components.raycaster.refreshObjects()
    }
  }
})
