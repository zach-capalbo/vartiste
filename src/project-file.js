import {Layer} from './layer.js'
import {base64ArrayBuffer} from './framework/base64ArrayBuffer.js'
import {base64ToBufferAsync} from './framework/base64ArrayBufferAsync.js'
import {addImageReferenceViewer, setupGlbReferenceEntity} from './file-upload.js'
import {Util} from './util.js'
import {BrushList} from './brush-list.js'
const FILE_VERSION = 2
class ProjectFile {
  static update(obj) {
    if (!('_fileVersion' in obj)) obj._fileVersion = 0
    if (!('width' in obj)) obj.width = 1024
    if (!('height' in obj)) obj.height = 512
    if (!('layers' in obj)) obj.layers = []
    if (!('projectName' in obj)) obj.projectName = 'project'
    if (!('shader' in obj)) obj.shader = 'flat'
    if (!('frameRate' in obj)) obj.frameRate = 10
    if (!('palette' in obj)) obj.palette = []
    if (!('useNodes' in obj)) obj.useNodes = false
    if (!('allNodes' in obj)) obj.allNodes = []
    if (!('flipY' in obj)) obj.flipY = true
    if (!('referenceImages' in obj)) obj.referenceImages = []
    if (!('referenceModels' in obj)) obj.referenceModels = []
    if (!('referenceGLBs' in obj)) obj.referenceGLBs = []
    if (!('environment' in obj)) obj.environment = {state: 'reset'}
    if (!('backgroundColor' in obj)) obj.backgroundColor = '#333'
    if (!('tools' in obj)) obj.tools = []
    if (!('exportJPEG' in obj)) obj.exportJPEG = false
    if (!('userBrushes' in obj)) obj.userBrushes = []

    if (!('showFloor' in obj.environment)) obj.environment.showFloor = false

    if ('skeletonator' in obj)
    {
      if (!('frameCount' in obj.skeletonator)) obj.skeletonator.frameCount = 50
    }

    for (let i in obj.layers)
    {
      let layer = obj.layers[i]
      if (!('transform' in layer)) layer.transform = Layer.EmptyTransform()
      if (!('rotation' in layer.transform)) layer.transform.rotation = 0
      if ('updateTime' in layer) delete layer.updateTime
      if (!('shelfMatrix' in layer)) {
        let matrix = new THREE.Matrix4()
        matrix.scale({x: 0.3, y: 0.3, z: 0.3})
        matrix.setPosition(0, i, 0)
        layer.shelfMatrix = {"elements":matrix.elements}
      }
      if (obj._fileVersion < 1)
      {
        if (layer.mode === 'bumpMap')
        {
          console.log("Updating old bump map")
          layer.opacity = Math.pow(layer.opacity, 1/2.2)
        }
      }
    }
    for (let i in obj.canvases)
    {
      if (obj._fileVersion < 2)
      {
        console.log("Reconstituting old canvases")
        obj.canvases[i] = [obj.canvases[i]]
      }
    }
    for (let node of obj.allNodes)
    {
      if ('updateTime' in node) delete node.updateTime
    }
  }

  static async load(obj, {compositor}) {
    console.log("Loading")
    ProjectFile.update(obj)
    let settings = document.getElementsByTagName('a-scene')[0].components['settings-system']
    settings.setProjectName(obj.projectName)
    settings.el.setAttribute('settings-system', {'exportJPEG': obj.exportJPEG})

    document.querySelector('#project-palette').setAttribute('palette', {colors: obj.palette})

    let environmentManager = compositor.el.sceneEl.systems['environment-manager']
    if (obj.environment.state === 'reset') {
      environmentManager.reset()
      document.querySelector('a-sky').setAttribute('material', 'color', obj.backgroundColor)
    }
    else if (obj.environment.state === 'preset-hdri')
    {
      environmentManager.usePresetHDRI()
    }
    else if (obj.environment.state == 'STATE_HDRI')
    {
      console.log("Reloading HDRI")
      let hdriTexture = new THREE.DataTexture(
        await new Uint8Array(await base64ToBufferAsync(obj.environment.image.data)),
        obj.environment.image.width,
        obj.environment.image.height,
        obj.environment.image.format,
        obj.environment.image.type,
        obj.environment.image.mapping,
        false,
        false,
        undefined,
        undefined,
        false,
        obj.environment.image.encoding,
      )
      hdriTexture.flipY = obj.environment.image.flipY
      hdriTexture.needsUpdate = true
      environmentManager.installHDREnvironment(hdriTexture)
    }
    else if (obj.environment.state === 'STATE_ENVIROPACK')
    {
      environmentManager.useEnviropack(obj.environment.substate)
    }

    document.querySelector('#environment-place').setAttribute('visible', obj.environment.showFloor)

    await compositor.load(obj)
    compositor.el.setAttribute('material', {shader: obj.shader})

    if (obj.glb)
    {
      let loader = new THREE.GLTFLoader()
      let buffer = await base64ToBufferAsync(obj.glb)
      let model = await new Promise((r, e) => loader.parse(buffer, "", r, e))

      settings.addModelView(model)
    }

    for (let ref of obj.referenceImages)
    {
      console.log("Loading reference image...")
      let image = new Image()
      await new Promise((r,e) => {
        image.onload = r
        image.src = ref.src
      })
      image.onload = undefined
      let viewer = addImageReferenceViewer(image)
      viewer.object3D.matrix.fromArray(ref.matrix)
      viewer.object3D.matrix.decompose(
        viewer.object3D.position,
        viewer.object3D.quaternion,
        viewer.object3D.scale,
      )
    }

    let referenceContainer = document.querySelector('#reference-spawn')
    let objectLoader = new THREE.ObjectLoader();
    for (let refJson of obj.referenceModels)
    {
      console.log("Loading reference model")
      let newEl = document.createElement('a-entity')
      referenceContainer.append(newEl)
      newEl.object3D.copy(objectLoader.parse(refJson))
      newEl.setObject3D('mesh', newEl.object3D.children[0])
      setupGlbReferenceEntity(newEl)
    }

    let glbLoader = new THREE.GLTFLoader()
    for (let glb of obj.referenceGLBs)
    {
      console.log("Loading reference glb")
      let buffer = await base64ToBufferAsync(glb)
      let model = await new Promise((r, e) => glbLoader.parse(buffer, "", r, e))
      let newEl = document.createElement('a-entity')
      referenceContainer.append(newEl)
      newEl.object3D.copy(model.scenes[0].children[0])
      newEl.setObject3D('mesh', model.scenes[0].children[0].children[0])
      setupGlbReferenceEntity(newEl)
    }

    if ('skeletonator' in obj)
    {
      compositor.el.skeletonatorSavedSettings = obj.skeletonator
    }

    settings.el.sceneEl.systems['brush-system'].addUserBrushes(obj.userBrushes)

    for (let tool of obj.tools)
    {
      let el = document.createElement('a-entity')
      compositor.el.sceneEl.append(el)
      el.setAttribute('six-dof-tool', {lockedClone: true, lockedComponent: tool.component})
      el.setAttribute(tool.component, tool.componentData)
      if ('tooltip' in tool)
      {
        el.setAttribute('preactivate-tooltip', tool.tooltip)
      }
      if ('componentDependencies' in tool)
      {
        for (let dependency in tool.componentDependencies)
        {
          el.setAttribute(dependency, tool.componentDependencies[dependency])
        }
      }
      let matrix = new THREE.Matrix4()
      matrix.fromArray(tool.matrix)
      Util.whenLoaded(el, () => {
        Util.applyMatrix(matrix, el.object3D)
      })
    }

    if (obj.materialPack)
    {
      let buffer = await base64ToBufferAsync(obj.materialPack[0])
      let model = await new Promise((r, e) => glbLoader.parse(buffer, "", r, e))
      settings.el.systems['material-pack-system'].addPacksFromObjects(model.scenes[0])
    }
  }

  async _save() {
    let obj = {}
    obj._fileVersion = FILE_VERSION
    let settings = document.querySelector('a-scene').systems['settings-system']
    obj.projectName = settings.projectName
    obj.exportJPEG = settings.data.exportJPEG
    Object.assign(obj, this.saveCompositor())

    let glbMesh = document.getElementById('composition-view').getObject3D('mesh')
    if (glbMesh)
    {
      let material = new THREE.MeshBasicMaterial()
      glbMesh.traverse(o => {
        if (o.type == "Mesh") { o.material = material}
      })

      let exporter = new THREE.GLTFExporter()
      let glb = await new Promise((r, e) => {
        exporter.parse(glbMesh, r, {binary: true})
      })
      obj.glb = base64ArrayBuffer(glb)
    }

    obj.palette = document.querySelector('#project-palette').getAttribute('palette').colors

    obj.referenceImages = []
    let referenceCanvas = document.createElement('canvas')
    document.querySelectorAll('.reference-image').forEach(image => {
      if (!image.getObject3D('mesh').material.map || !image.getObject3D('mesh').material.map.image) return;

      let img = image.getObject3D('mesh').material.map.image
      referenceCanvas.width = img.width
      referenceCanvas.height = img.height
      referenceCanvas.getContext('2d').drawImage(img, 0, 0)
      let dataType = Util.isCanvasFullyOpaque(referenceCanvas) ? settings.imageURLType() : 'image/png'
      obj.referenceImages.push({
        src: referenceCanvas.toDataURL(dataType, settings.compressionQuality()),
        matrix: image.object3D.matrix.elements
      })
    })

    obj.referenceGLBs = []
    obj.referenceModels = []
    let referenceEls = Array.from(document.querySelectorAll('.reference-glb'));

    for (let el of referenceEls)
    {
      try {
        let glb = await settings.getExportableGLB(el.object3D)
        let buffer = base64ArrayBuffer(glb)
        obj.referenceGLBs.push(buffer)
      } catch (e) {
        console.warn("Error exporting", el, "as GLB. Saving as JSON")
        obj.referenceModels.push(el.object3D.toJSON())
      }
    }

    let skeletonatorEl = document.querySelector('*[skeletonator]')
    if (skeletonatorEl)
    {
      this.saveSkeletonator(obj, skeletonatorEl.components.skeletonator)
    }
    else if (Compositor.el.skeletonatorSavedSettings)
    {
      obj.skeletonator = Compositor.el.skeletonatorSavedSettings
    }

    let environmentManager = Compositor.el.sceneEl.systems['environment-manager']
    if (environmentManager.substate == 'preset-hdri')
    {
      obj.environment = {state: 'preset-hdri'}
    }
    else if (environmentManager.state == 'STATE_HDRI')
    {
      obj.environment = {
        state: 'STATE_HDRI',
        image: {
          format: environmentManager.hdriTexture.format,
          type: environmentManager.hdriTexture.type,
          mapping: environmentManager.hdriTexture.mapping,
          encoding: environmentManager.hdriTexture.encoding,
          flipY: environmentManager.hdriTexture.flipY,
          data: base64ArrayBuffer(environmentManager.hdriTexture.image.data.buffer),
          width: environmentManager.hdriTexture.image.width,
          height: environmentManager.hdriTexture.image.height
        }
      }
    }
    else if (environmentManager.state == 'STATE_ENVIROPACK')
    {
      obj.environment = {
        state: 'STATE_ENVIROPACK',
        substate: environmentManager.substate
      }
    }
    else
    {
      obj.environment = {state: 'reset'}
    }
    obj.environment.showFloor = document.querySelector('#environment-place').getAttribute('visible')
    obj.backgroundColor = document.querySelector('a-sky').getAttribute('material').color

    obj.userBrushes = []

    for (let brush of BrushList) {
      if (!brush.user) continue;
      obj.userBrushes.push(brush.fullStore())
    }

    obj.tools = []

    // document.querySelectorAll('*[six-dof-tool]').forEach(el => {
    document.querySelectorAll('a-entity[pencil-tool],a-entity[camera-tool]').forEach(el => {
      let data = el.getAttribute('six-dof-tool')
      if (!data.lockedClone) return
      let lockedComponent = el.components[data.lockedComponent]
      el.object3D.updateMatrixWorld()

      let dependencies = {}
      for (let dependency of data.lockedComponentDependencies)
      {
        if (!el.hasAttribute(dependency)) continue
        dependencies[dependency] = el.getAttribute(dependency)
      }

      obj.tools.push({
        component: data.lockedComponent,
        componentData: lockedComponent.stringify(lockedComponent.data),
        matrix: el.object3D.matrixWorld.elements,
        componentDependencies: dependencies,
      })
    })

    let materialPackRoot = new THREE.Object3D
    document.querySelectorAll('.user[material-pack] .view').forEach(el => {
      materialPackRoot.add(el.getObject3D('mesh').clone())
    })
    if (materialPackRoot.children.length)
    {
      let oldExportJPEG = settings.data.exportJPEG
      settings.data.exportJPEG = true
      obj.materialPack = [await base64ArrayBuffer(await settings.getExportableGLB(materialPackRoot))]
      settings.data.exportJPEG = oldExportJPEG
    }

    return obj
  }

  constructor({compositor}) {
    this.compositor = compositor
  }

  static async save(...args) {
    return await (new ProjectFile(...args))._save()
  }

  saveCompositor() {
    let {compositor} = this
    let {layers, allNodes} = compositor
    let settings = compositor.el.sceneEl.systems['settings-system']

    return {
      layers,
      allNodes,
      useNodes: compositor.data.useNodes,
      width: compositor.width,
      height: compositor.height,
      shader: compositor.el.getAttribute('material').shader,
      frameRate: compositor.data.frameRate,
      flipY: compositor.data.flipY,
      canvases: layers.map(l => l.frames.map(f => f.toDataURL(settings.imageURLType(f), settings.compressionQuality())))
    }
  }

  saveSkeletonator(inputObj, skeletonator) {
    let obj  = {}
    obj.boneTracks = skeletonator.boneTracks
    obj.frameCount = skeletonator.data.frameCount
    inputObj.skeletonator = obj
  }
}

export {ProjectFile}
