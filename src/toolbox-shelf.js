import {CanvasRecorder} from './canvas-recorder.js'
import {Util} from './util.js'
import Gif from 'gif.js'
import {Pool} from './pool.js'
import {Undo} from './undo.js'
import {bumpCanvasToNormalCanvas} from './material-transformations.js'

import './framework/SubdivisionModifier.js'
import './framework/SimplifyModifier.js'

function lcm(x,y) {
  return Math.abs((x * y) / gcd(x,y))
}

function gcd(x, y) {
  x = Math.abs(x);
  y = Math.abs(y);
  var t
  while(y) {
    t = y;
    y = x % y;
    x = t;
  }
  return x;
}


AFRAME.registerComponent('toolbox-shelf', {
  init() {
    Pool.init(this)
    this.el.addEventListener('click', (e) => {
      if (e.target.hasAttribute('node-fx'))
      {
        this.applyFXAction(e.target.getAttribute('node-fx'))
        return
      }

      let action = e.target.getAttribute("click-action") + 'Action';
      if (action in this)
      {
        console.log("Running toolbox action", action)
        this[action]()
      }
      else
      {
        console.warn("No such toolbox action", action)
      }
    })
  },
  mirrorAnimationAction() {
    let compositor = document.getElementById('canvas-view').components.compositor
    compositor.activeLayer.frames = compositor.activeLayer.frames.concat(compositor.activeLayer.frames.slice(1,-1).reverse)
    compositor.el.emit('layerupdated', {layer: compositor.activeLayer})
  },
  mergeFramesAction(source, target, {deleteLayer = true} = {}) {
    let compositor = document.getElementById('canvas-view').components.compositor
    source = (typeof source === 'undefined') ? compositor.activeLayer : source
    let activeLayerIdx = compositor.layers.indexOf(source)
    target = (typeof target === 'undefined') ? compositor.layers[activeLayerIdx - 1] : target
    console.log("Source", source, "Target", target)
    let numFrames = lcm(source.frames.length, target.frames.length)

    let newFrames = []

    console.log("Num Frames", numFrames)

    for (let f = target.frames.length; f < numFrames; ++f)
    {
      let newFrame = document.createElement('canvas')
      newFrame.width = target.width
      newFrame.height = target.height
      let ctx = newFrame.getContext('2d')
      ctx.globalCompositeOperation = 'copy'
      ctx.drawImage(target.frame(f), 0, 0)
      ctx.globalCompositeOperation = 'source-over'
      newFrames.push(newFrame)
    }

    target.frames = target.frames.concat(newFrames)

    for (let i = 0; i < numFrames; i++)
    {
      compositor.jumpToFrame(i)
      compositor.mergeLayers(source,target)
    }

    compositor.el.emit('layerupdated', {layer: target})
    if (deleteLayer) compositor.deleteLayer(source)
    //compositor.activeLayer(target)
  },
  collapseLayersAction() {
    let compositor = document.getElementById('canvas-view').components.compositor
    let startIdx
    for (startIdx = 0; startIdx < compositor.layers.length; startIdx++)
    {
      if (compositor.layers[startIdx].mode.endsWith("Map")) continue;
      break
    }
    let layersToDelete = []
    for (let i = startIdx + 1; i < compositor.layers.length; i++)
    {
      if (compositor.layers[i].mode.endsWith("Map")) continue;
      this.mergeFramesAction(compositor.layers[i], compositor.layers[startIdx])
      layersToDelete.push(compositor.layers[i])
    }

    for (let layer of layersToDelete)
    {
      compositor.deleteLayer(layer)
    }
  },
  collapseLayersPerFrameAction() {
    let compositor = document.getElementById('canvas-view').components.compositor
    let startIdxs = {}
    let layersToDelete = []
    let startLength = compositor.layers.length
    for (let i = 0; i < startLength; ++i)
    {
      if (compositor.layers[i].mode.endsWith("Map")) continue;

      let frames = compositor.layers[i].frames.length
      if (!(frames in startIdxs))
      {
        compositor.addLayer(compositor.layers.length)
        startIdxs[frames] = compositor.layers[compositor.layers.length - 1]
      }

      this.mergeFramesAction(compositor.layers[i], startIdxs[frames], {deleteLayer: false})
      layersToDelete.push(compositor.layers[i])
    }

    for (let layer of layersToDelete)
    {
      compositor.deleteLayer(layer)
    }
  },
  async recordHeadsetAction() {
    if (!this.compositeRecorder)
    {
      this.compositeRecorder = new CanvasRecorder({canvas: document.querySelector('.a-canvas'), frameRate: 60})
      this.compositeRecorder.start()
    }
    else
    {
      await this.compositeRecorder.stop()
      this.el.sceneEl.systems['settings-system'].download(this.compositeRecorder.createURL(), `${this.el.sceneEl.systems['settings-system'].projectName}-${this.el.sceneEl.systems['settings-system'].formatFileDate()}.webm`, "Video Recording")
      delete this.compositeRecorder
    }
  },
  startSkeletonatorAction() {
    let skeletonatorEl = document.querySelector('*[skeletonator]')

    if (!skeletonatorEl)
    {
      document.querySelector('#composition-view').setAttribute('skeletonator', "")
      return
    }

    document.querySelector('*[skeletonator-control-panel] *[shelf-summoner]').components['shelf-summoner'].summon()
    skeletonatorEl.components.skeletonator.play()
  },

  toggleLatheAction() {
    document.querySelectorAll('*[lathe]').forEach(e=>e.setAttribute('lathe', {enabled: !e.getAttribute('lathe').enabled}))
  },
  presentationAction() {
    this.el.sceneEl.systems.networking.presentationMode()
  },
  captureRenderAction() {
    let {width, height} = Compositor.el.getAttribute('geometry')
    Compositor.el.object3D.updateMatrixWorld()

    let offset = new THREE.Object3D()
    Compositor.el.object3D.add(offset)
    offset.position.z += 10

    let scale = this.pool('scale', THREE.Vector3)
    scale.setFromMatrixScale(Compositor.el.object3D.matrixWorld)
    width = width * scale.x
    height = height * scale.y

    let camera = new THREE.OrthographicCamera(-width / 2, width / 2, height / 2, - height / 2, 0.0001, 10)

    // Only show the canvas
    camera.layers.mask = 2
    let scene = this.el.sceneEl.object3D
    console.log("Caputreing", width, height, camera)

    scene.add(camera)
    //
    // var helper = new THREE.CameraHelper( camera );
    // scene.add( helper );

    Util.positionObject3DAtTarget(camera, offset, {scale: {x:1,y:1,z:1}})

    let oldOverlay = Compositor.component.data.drawOverlay

    Compositor.component.data.drawOverlay = false

    Compositor.component.quickDraw()

    // Compositor.el.object3D.add(camera)
    let downloadUrl = this.el.sceneEl.systems['camera-capture'].captureToCanvas(camera).toDataURL()

    Compositor.component.data.drawOverlay = oldOverlay

    let settings = this.el.sceneEl.systems['settings-system']
    settings.download(downloadUrl, `${settings.projectName}-${settings.formatFileDate()}-render.png`, "Rendered Canvas")

    scene.remove(camera)

  },
  applyFXAction(fx = "invert") {
    let layer = Compositor.component.activeLayer
    let canvas = Compositor.drawableCanvas
    Undo.pushCanvas(canvas)
    let processor = new CanvasShaderProcessor({fx})
    processor.setInputCanvas(canvas)
    processor.update()
    let ctx = canvas.getContext('2d')
    let oldOperation = ctx.globalCompositeOperation
    ctx.globalCompositeOperation = 'copy'
    ctx.drawImage(processor.canvas, 0, 0)
    ctx.globalCompositeOperation = oldOperation
    layer.touch()
  },
  downloadAllLayersAction() {
    let i = 0
    Compositor.component.layers.forEach(l => this.el.sceneEl.systems['settings-system'].download(l.canvas.toDataURL(), {extension: "png", suffix: i++}, l.id))
  },
  bumpCanvasToNormalCanvasAction() {
    Undo.collect(() => {
      Undo.pushCanvas(Compositor.drawableCanvas)
      bumpCanvasToNormalCanvas(Compositor.drawableCanvas, {normalCanvas: Compositor.drawableCanvas, bumpScale: Math.pow(Compositor.component.activeLayer.opacity, 2.2)})
      Compositor.drawableCanvas.touch()
      if (Compositor.component.activeLayer.mode === 'bumpMap')
      {
        Compositor.component.activeLayer.opacity = 1.0
        Compositor.component.setLayerBlendMode(Compositor.component.activeLayer, 'normalMap')
        Compositor.drawableCanvas.touch()
      }
    })
  },
  defaultSpectatorAction() {
    // let camera = this.el.sceneEl.querySelector('#perspective-camera')
    // camera.emit('activate')
    // camera.setAttribute('camera-tool', 'captureType', 'spectator')
    // Util.positionObject3DAtTarget(camera.object3D, this.el.sceneEl.camera, {transformOffset: {x: 0, y: 0, z: 0.3}})

    let camera = this.el.sceneEl.camera.clone()
    this.el.sceneEl.object3D.add(camera)
    Util.positionObject3DAtTarget(camera, this.el.sceneEl.camera, {transformOffset: {x: 0, y: 0, z: 0.2}})
    this.el.sceneEl.setAttribute('spectator-camera', {state: 'SPECTATOR_CAMERA', camera: camera})
  },
  mergeDownNormalMap() {
    let layer = Compositor.component.activeLayer
    let targetLayer = Compositor.component.layers[Compositor.component.layers.indexOf(layer) - 1]
  },
  async exportObjAction() {
    await import('./framework/OBJExporter.js')
    let exporter = new THREE.OBJExporter()

    let meshes = Compositor.meshes;

    let mesh = meshes[0].clone();

    mesh.updateMatrixWorld()
    mesh.geometry = mesh.geometry.clone();

    let inv = new THREE.Matrix4().copy(mesh.matrixWorld)
    inv.invert();

    let geos = [mesh.geometry]

    for (let i = 1; i < meshes.length; ++i)
    {
      let other = meshes[i]
      let geo = other.geometry.clone()
      geo.applyMatrix4(other.matrixWorld)
      geo.applyMatrix4(inv)
      geos.push(geo)
    }

    for (let geo of geos)
    {
      
    }

    mesh.geometry = THREE.BufferGeometryUtils.mergeBufferGeometries(geos, false)

    let obj = exporter.parse(mesh)
    this.el.sceneEl.systems['settings-system'].download("data:application/x-binary;base64," + btoa(obj), {extension: 'obj', suffix:''})
  }
})
