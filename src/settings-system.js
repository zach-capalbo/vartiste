import {THREED_MODES} from './layer-modes.js'
import {base64ArrayBuffer} from './framework/base64ArrayBuffer.js'
import {prepareModelForExport, dedupMaterials} from './material-transformations.js'
import {ProjectFile} from './project-file.js'
import {Undo, UndoStack} from './undo.js'
import {Util} from './util.js'
import {Pool} from './pool.js'
import {Sfx} from './sfx.js'
import Pako from 'pako'
import CompressionWorker from './compression.worker.js'

import { WebIO } from '@gltf-transform/core';
import { dedup, quantize, weld, resample, prune } from '@gltf-transform/functions';
import { KHRONOS_EXTENSIONS, DracoMeshCompression } from '@gltf-transform/extensions';

import './wasm/draco_encoder.js';

window.CompressionWorker = CompressionWorker

import {CanvasRecorder} from './canvas-recorder.js'
import Dexie from 'dexie'
Util.registerComponentSystem('settings-system', {
  schema: {
    addReferences: {default: false},
    exportJPEG: {default: false},
    compressProject: {default: true},
    extra3DCompression: {default: true},
    dracoCompression: {default: false},
    centerOnExport: {default: true},
    pruneEmptyNodes: {default: true},
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

    Sfx.play('confirmation', this.el, {volume: 0.7})
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

    Sfx.play('confirmation', this.el, {volume: 0.7})
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
  imageURLType(canvas, mapName, {smartCompression} = {}) {
    if (!canvas) return (this.data.exportJPEG || smartCompression) ? "image/jpeg" : "image/png"
    if (this.data.exportJPEG || smartCompression) return Util.isCanvasFullyOpaque(canvas) ? "image/jpeg" : "image/png"
    return "image/png"
  },
  compressionQuality(canvas, mapName, {compressionQualityOverride, smartCompression} = {}) {
    if (compressionQualityOverride) return compressionQualityOverride;
    if (smartCompression &&
        (mapName === 'aoMap' || mapName === 'metalnessMap')) return 0.55;

    return this.data.exportJPEG ? 0.85 : undefined;
  },
  maxTextureSize(image, mapName, {smartCompression} = {}) {
    if (smartCompression) {
        if (mapName === 'aoMap' || mapName === 'metalnessMap') return Math.floor(Math.max(Compositor.component.width, Compositor.component.height) / 2)
        return Math.max(Compositor.component.width, Compositor.component.height)
    }
    return Infinity
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
          worker.postMessage(saveObj)
        })
      }
      finally
      {
        worker.onmessage = null
        worker.onerror = null
        worker.terminate();
      }
      console.timeEnd('compressProject')
      this.download(data, `${this.projectName}-${this.formatFileDate()}.vartistez`, "Project File")
    }
    else
    {
      let json = JSON.stringify(saveObj)
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
  async postTransformGLB(glb) {
    let io = this.webIO;

    if (!io)
    {
      io = this.webIO = new WebIO().registerExtensions(KHRONOS_EXTENSIONS);
    }

    let doc = io.readBinary(glb)
    await doc.transform(
      // weld(),
      // this.data.dracoCompression ? dedup() : quantize(),
      dedup(),
      resample(),
      prune(),
    )

    if (this.data.dracoCompression)
    {
      if (!this.registerDraco)
      {
        this.registerDraco = new Promise(async (r, e) => {
          await io.registerDependencies({
            'draco3d.encoder': await new DracoEncoderModule()
          });
          r();
        })
      }

      await this.registerDraco;

      doc.createExtension(DracoMeshCompression)
      .setRequired(true)
      .setEncoderOptions({
          method: DracoMeshCompression.EncoderMethod.EDGEBREAKER,
          encodeSpeed: 5,
          decodeSpeed: 5,
      });
    }

    return await io.writeBinary(doc)
  },
  async getExportableGLB(exportMesh, {undoStack, compressionQualityOverride, smartCompression} = {}) {
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

    let animation3d = this.el.sceneEl.systems['animation-3d'];
    if (animation3d) {
      if (Compositor.component.isPlayingAnimation)
      {
        Compositor.component.setIsPlayingAnimation(false)
      }
      mesh.traverse(o => {
        if (animation3d.visibilityTracks.has(o)) o.visible = true
      })
    }

    if (smartCompression)
    {
      dedupMaterials(exportMesh, {undoStack})
    }

    // Need to traverse to get all materials
    mesh.traverseVisible(m => {
      if (m.geometry || m.material)
      {
        prepareModelForExport(m, m.material, {undoStack})
      }
    })

    function pruneEmptyNodes(o, undoStack) {
      if (!o.visible) return false
      let anyVisible = false

      if (o.material) return true
      if (o.isBone) return true

      for (let c of o.children) {
        if (pruneEmptyNodes(c, undoStack)) anyVisible = true
      }

      if (!anyVisible) {
        if (undoStack) undoStack.push(() => o.visible = true)
        o.visible = false
      }

      return anyVisible
    }

    if (this.data.pruneEmptyNodes)
    {
      pruneEmptyNodes(mesh, undoStack)
    }

    mesh.traverseVisible(o => {
      if (o.el && o.el.object3D === o && o.el.id && !o.name) o.name = o.el.id
    })

    function postProcessJSON(outputJSON) {
      if (!outputJSON.extensions) outputJSON.extensions = {}

      AFRAME.utils.extendDeep(outputJSON.extensions, mesh.userData.gltfExtensions)
    }

    if (animation3d) {
      let activeAnimation = animation3d.generateAnimation(mesh)
      if (mesh.animations)
      {
        mesh.animations.push(activeAnimation)
      }
      else
      {
        mesh.animations = [activeAnimation]
      }
    }

    let imageOpts = {compressionQualityOverride, smartCompression}

    let exporter = new THREE.GLTFExporter()
    let glb = await new Promise((r, e) => {
      exporter.parse(mesh, r, {
        binary: true,
        animations: mesh.animations || [],
        includeCustomExtensions: true,
        mimeType: (canvas, mapName) => this.imageURLType(canvas, mapName, imageOpts),
        imageQuality: (canvas, mapName) => this.compressionQuality(canvas, mapName, imageOpts),
        maxTextureSize: (image, mapName) => this.maxTextureSize(image, mapName, imageOpts),
        postProcessJSON})
    })

    if (material.map && originalImage)
    {
      material.map.image = originalImage
      material.map.needsUpdate = true
    }

    if (smartCompression && (!mesh.userData.gltfExtensions || mesh.userData.gltfExtensions.length === 0))
    {
      glb = await this.postTransformGLB(glb)
    }

    return glb
  },
  async export3dAction(exportMesh, {extension, compressionQualityOverride, smartCompression} = {}) {
    if (!exportMesh) exportMesh = Compositor.meshRoot
    let undoStack = new UndoStack({maxSize: -1})

    if (typeof smartCompression === 'undefined') smartCompression = this.data.extra3DCompression;

    let glb = await this.getExportableGLB(exportMesh, {undoStack, compressionQualityOverride, smartCompression})

    if (!extension && exportMesh.userData && exportMesh.userData.gltfExtensions && exportMesh.userData.gltfExtensions.VRM)
    {
      extension = 'vrm'
    }
    else if (!extension)
    {
      extension = 'glb'
    }

    this.download("data:model/gltf-binary;base64," + base64ArrayBuffer(glb), `${this.projectName}-${this.formatFileDate()}.${extension}`, "GLB File")

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
  redoAction() {
    Undo.redoStack.undo()
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
  },
  clearModels() {
    this.el.sceneEl.systems['primitive-constructs'].clearAll()
    this.el.querySelectorAll('a-entity[reference-glb]').forEach(el => {
      Util.disposeEl(el)
    })
    this.el.querySelector('#composition-view').removeObject3D('mesh')
  }
})

Util.registerComponentSystem('export-3d-helper-system', {
  schema: {
    exportCanvas: {default: false, selector: '#canvas-view'},
    exportMesh: {default: true, selector: '#composition-view'},
    exportShapes: {default: true, selector: '#shape-root'},
    exportReferenceObjects: {default: true, selector: '#reference-spawn'},
  },
  async runExportFn(fn) {
    let objects = []
    for (let prop in this.schema)
    {
      if (this.data[prop])
      {
        objects.push(this.el.sceneEl.querySelector(this.schema[prop].selector))
      }
    }

    let foundAny = objects.map(o => Util.traverseFindAll(o.object3D, oo => (!oo.userData.vartisteUI) && oo.material).length).some(l => l > 0)

    if (!foundAny)
    {
      console.log("Could not found any meshes to export", objects)
      objects = [Compositor.el]
    }

    // if (objects.length === 1)
    // {
    //   await fn(objects[0].object3D)
    //   return
    // }

    let oldProps = new Map()

    for (let prop in this.schema)
    {
      let el = this.el.sceneEl.querySelector(this.schema[prop].selector)
      oldProps.set(el, {
        visible: el.object3D.visible
      })

      if (this.data[prop] || (!foundAny && prop === 'exportCanvas'))
      {
        el.object3D.visible = true
      }
      else
      {
        el.object3D.visible = false
      }
    }

    let originalMap = Compositor.material.map.image
    Compositor.material.map.image = Compositor.component.preOverlayCanvas
    Compositor.material.map.needsUpdate = true
    let root = this.el.sceneEl.querySelector('#canvas-root').object3D
    let box
    let worldScale
    let originalPosition
    if (this.el.sceneEl.systems['settings-system'].data.centerOnExport)
    {
      originalPosition = new THREE.Vector3().copy(root.position)
      root.position.set(0, 0, 0)
      box = Util.recursiveBoundingBox(root, {onlyVisible: true, includeUI: false})
      worldScale = new THREE.Vector3
      root.getWorldScale(worldScale)
      console.log("Export box", box)
      for (let c of root.children)
      {
        c.position.x += - (box.max.x + box.min.x) / 2 / worldScale.x
        c.position.y += - box.min.y / worldScale.y
        c.position.z += - (box.max.z + box.min.z) / 2 / worldScale.z
      }
    }
    else if (this.data.exportMesh && !this.data.exportShapes && !this.data.exportReferenceObjects && !this.data.exportCanvas && Util.traverseFind(root, o => o.skeleton, {visibleOnly: true}))
    {
      root = Util.traverseFind(this.el.sceneEl.querySelector('#composition-view').getObject3D('mesh'), o => {
        if (o.name.startsWith('AuxScene')) return false;
        return true;
      }, {visibleOnly: true})
    }

    try {
      await fn(root)
    }
    finally {
      if (this.el.sceneEl.systems['settings-system'].data.centerOnExport)
      {
        root.position.copy(originalPosition)
        for (let c of root.children)
        {
          c.position.x -= - (box.max.x + box.min.x) / 2 / worldScale.x
          c.position.y -= - box.min.y / worldScale.y
          c.position.z -= - (box.max.z + box.min.z) / 2 / worldScale.z
        }
      }

      for (let [el, p] of oldProps.entries())
      {
        el.object3D.visible = p.visible
      }

      Compositor.material.map.image = originalMap
      Compositor.material.map.needsUpdate = true
    }
  },
  export3dAction() {
    this.runExportFn(async rootObj => {
      this.el.sceneEl.systems['settings-system'].export3dAction(rootObj)
    })
    // this.el.sceneEl.systems['settings-system'].export3dAction()
  },
  push3dUrlAction(url) {
    let busy = this.el.sceneEl.systems['busy-indicator'].busy({title: `POST to ${url}` })
    this.runExportFn(async rootObj => {
      let undoStack = new UndoStack(-1);
      let glb = await this.el.sceneEl.systems['settings-system'].getExportableGLB(rootObj, {undoStack})

      try {
        let response = await fetch(url, {
          method: 'POST',
          mode: 'cors',
          redirect: 'follow',
          body: new Blob([glb], {type: 'model/gltf-binary'}),
        })
        if (!response.ok)
        {
          console.error(response)
          busy.error(`${response.status}: ${response.statusText}`)
        }
      } catch (e) {
        busy.error(e)
      }

      busy.done()
    })
  },
  cloneAsReference() {
    this.runExportFn(async rootObj => {
      let el = document.createElement('a-entity')
      el.setAttribute('reference-glb', '')
      el.classList.add('clickable')
      document.querySelector('#reference-spawn').append(el)

      let material = Compositor.component.frozenMaterial()

      let newObject = rootObj.clone(true)
      newObject.traverse(o => {
        if (o.material && o.material === Compositor.material)
        {
          o.material = material
        }
        if (o.type === 'SkinnedMesh')
        {
          let base = Compositor.meshes.find(m => m.name === o.name)
          if (!base) return
          o.bind(new THREE.Skeleton(base.skeleton.bones.map(b => b.clone()), base.skeleton.boneInverses.map(i => new THREE.Matrix4().copy(i))), new THREE.Matrix4().copy(base.bindMatrix))
        }
      })
      newObject.matrix.identity()
      // Util.applyMatrix(Compositor.meshRoot.el.object3D.matrix, newObject)
      el.setObject3D('mesh', newObject)
      await Util.whenLoaded(el)
      Util.positionObject3DAtTarget(el.object3D, rootObj)
      console.log("Setting reference", newObject, el)
    })
  }
})

AFRAME.registerComponent('export-origin-helper', {
  init() {

  }
})

AFRAME.registerComponent('push-to-url-button', {
  schema: {
    mode: {oneOf: ['2d', '3d']},
  },
  events: {
    editfinished: function(e) {
      let url = e.detail.value
      localStorage.lastURL = url
      this.el.sceneEl.systems['export-3d-helper-system'].push3dUrlAction(url)
    }
  },
  init() {
    this.el.setAttribute('text', 'value', localStorage.lastURL)
  }
})
