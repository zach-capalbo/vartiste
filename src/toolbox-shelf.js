import { CanvasRecorder } from './canvas-recorder.js'
import { Util } from './util.js'
import Gif from 'gif.js'
import { Pool } from './pool.js'
import { Undo } from './undo.js'
import { VectorBrush } from './brush.js'
import { Layer } from './layer.js'
import { bumpCanvasToNormalCanvas } from './material-transformations.js'
import { STATE_PRESSED } from './icon-button.js'

import './framework/SubdivisionModifier.js'
import './framework/SimplifyModifier.js'
import { XRControllerModelFactory } from 'three/examples/jsm/webxr/XRControllerModelFactory.js'
import { XRHandModelFactory } from 'three/examples/jsm/webxr/XRHandModelFactory.js'

const {
  Computer,
  ComputerConnection,
} = DesktopVision.loadSDK(THREE, XRControllerModelFactory, XRHandModelFactory);

function lcm(x, y) {
  return Math.abs((x * y) / gcd(x, y))
}

function gcd(x, y) {
  x = Math.abs(x);
  y = Math.abs(y);
  var t
  while (y) {
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
      if (e.target.hasAttribute('node-fx')) {
        this.applyFXAction(e.target.getAttribute('node-fx'))
        return
      }

      let action = e.target.getAttribute("click-action") + 'Action';
      if (action in this) {
        console.log("Running toolbox action", action)
        this[action]()
      }
      else {
        console.warn("No such toolbox action", action)
      }
    })
  },
  async connectToDesktopVisionAction() {
    this.removeComputerAction();
    const scope = encodeURIComponent("connect,list");
    const clientID = "wG99zpg7aA2mwwmm8XHV"
    const redirectURL = new URL(window.location.href);
    const scene = this.el.sceneEl
    const renderer = scene.renderer

    const session = renderer.xr.getSession();
    if (session !== null) {
      await session.end();
    }

    redirectURL.searchParams.set("oauth", "desktopvision");
    const redirectUri = encodeURIComponent(redirectURL);
    window.open(`https://desktop.vision/login/?response_type=code&client_id=${clientID}&scope=${scope}&redirect_uri=${redirectUri}&redirect_type=popup&selectComputer=true`);

    let roomOptionsInterval = setInterval(() => {
      try {
        const options = localStorage.getItem('DESKTOP_VISION_ROOM_OPTIONS')
        localStorage.setItem("DESKTOP_VISION_ROOM_OPTIONS", null)
        const roomOptions = JSON.parse(options)
        if (roomOptions) {
          clearInterval(roomOptionsInterval)
          this.createComputer(roomOptions)
        }
      } catch (e) {
      }
    });
  },

  createComputer(roomOptions) {
    const sceneContainer = document.querySelector('a-scene')
    const parent =  document.querySelector('#camera-offsetter').object3D
    
    const scene = this.el.sceneEl
    const camera = scene.camera
    const renderer = scene.renderer

    this.computerConnection = new ComputerConnection(roomOptions);
    this.video = document.createElement("video");
    this.computerConnection.on("stream-added", (newStream) => {
      const { video, computerConnection } = this
      video.setAttribute('webkit-playsinline', 'webkit-playsinline');
      video.setAttribute('playsinline', 'playsinline');
      video.srcObject = newStream;
      video.muted = false
      video.play();
      const desktopOptions = {
        renderScreenBack: true,
        initialScalar: 1,
        initialWidth: 2,
        hideMoveIcon: false,
        hideResizeIcon: false,
        includeKeyboard: true,
        renderAsLayer: false,
        keyboardOptions: {
          hideMoveIcon: false,
          hideResizeIcon: false,
          keyColor: 'rgb(50, 50, 50)',
          highlightColor: 'rgb(50, 75, 100)',
        },
        xrOptions: {
          hideControllers: true,
          hideHands: true,
          hideCursors: true,
          hideRay: true,
          parent
        },
      }
      const desktop = new Computer(scene.object3D, sceneContainer, video, renderer, computerConnection, camera, desktopOptions);
      desktop.position.y = 2.6
      desktop.position.z = -2
      scene.object3D.add(desktop);
      this.desktop = desktop
    });
  },

  removeComputerAction() {
    const { video, computerConnection, desktop } = this
    if (!desktop) return
    try {
      computerConnection.disconnect()
    } catch (e) {

    }
    try {
      desktop.destroy()
    } catch (e) {

    }
  },

  mirrorAnimationAction() {
    let compositor = document.getElementById('canvas-view').components.compositor
    compositor.activeLayer.frames = compositor.activeLayer.frames.concat(compositor.activeLayer.frames.slice(1, -1).reverse)
    compositor.el.emit('layerupdated', { layer: compositor.activeLayer })
  },
  mergeFramesAction(source, target, { deleteLayer = true } = {}) {
    let compositor = document.getElementById('canvas-view').components.compositor
    source = (typeof source === 'undefined') ? compositor.activeLayer : source
    let activeLayerIdx = compositor.layers.indexOf(source)
    target = (typeof target === 'undefined') ? compositor.layers[activeLayerIdx - 1] : target
    console.log("Source", source, "Target", target)
    let numFrames = lcm(source.frames.length, target.frames.length)

    let newFrames = []

    console.log("Num Frames", numFrames)

    for (let f = target.frames.length; f < numFrames; ++f) {
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

    for (let i = 0; i < numFrames; i++) {
      compositor.jumpToFrame(i)
      compositor.mergeLayers(source, target)
    }

    compositor.el.emit('layerupdated', { layer: target })
    if (deleteLayer) compositor.deleteLayer(source)
    //compositor.activeLayer(target)
  },
  collapseLayersAction() {
    let compositor = document.getElementById('canvas-view').components.compositor
    let startIdx
    for (startIdx = 0; startIdx < compositor.layers.length; startIdx++) {
      if (compositor.layers[startIdx].mode.endsWith("Map")) continue;
      break
    }
    let layersToDelete = []
    for (let i = startIdx + 1; i < compositor.layers.length; i++) {
      if (compositor.layers[i].mode.endsWith("Map")) continue;
      this.mergeFramesAction(compositor.layers[i], compositor.layers[startIdx])
      layersToDelete.push(compositor.layers[i])
    }

    for (let layer of layersToDelete) {
      compositor.deleteLayer(layer)
    }
  },
  collapseLayersPerFrameAction() {
    let compositor = document.getElementById('canvas-view').components.compositor
    let startIdxs = {}
    let layersToDelete = []
    let startLength = compositor.layers.length
    for (let i = 0; i < startLength; ++i) {
      if (compositor.layers[i].mode.endsWith("Map")) continue;

      let frames = compositor.layers[i].frames.length
      if (!(frames in startIdxs)) {
        compositor.addLayer(compositor.layers.length)
        startIdxs[frames] = compositor.layers[compositor.layers.length - 1]
      }

      this.mergeFramesAction(compositor.layers[i], startIdxs[frames], { deleteLayer: false })
      layersToDelete.push(compositor.layers[i])
    }

    for (let layer of layersToDelete) {
      compositor.deleteLayer(layer)
    }
  },
  async recordHeadsetAction() {
    if (!this.compositeRecorder) {
      this.compositeRecorder = new CanvasRecorder({ canvas: document.querySelector('.a-canvas'), frameRate: 60 })
      this.compositeRecorder.start()
    }
    else {
      await this.compositeRecorder.stop()
      this.el.sceneEl.systems['settings-system'].download(this.compositeRecorder.createURL(), `${this.el.sceneEl.systems['settings-system'].projectName}-${this.el.sceneEl.systems['settings-system'].formatFileDate()}.webm`, "Video Recording")
      delete this.compositeRecorder
    }
  },
  startSkeletonatorAction() {
    let skeletonatorEl = document.querySelector('*[skeletonator]')

    if (!skeletonatorEl) {
      if (Compositor.nonCanvasMeshes.length > 0) {
        document.querySelector('#composition-view').setAttribute('skeletonator', "")
      }
      else {
        console.warn("No non-canvas meshes")
      }
      return
    }

    document.querySelector('*[skeletonator-control-panel] *[shelf-summoner]').components['shelf-summoner'].summon()
    skeletonatorEl.components.skeletonator.play()
  },

  toggleLatheAction() {
    document.querySelectorAll('*[lathe]').forEach(e => e.setAttribute('lathe', { enabled: !e.getAttribute('lathe').enabled }))
  },
  redoAction() {
    Undo.redoStack.undo()
  },
  presentationAction() {
    this.el.sceneEl.systems.networking.presentationMode()
  },
  captureRenderAction() {
    let { width, height } = Compositor.el.getAttribute('geometry')
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

    Util.positionObject3DAtTarget(camera, offset, { scale: { x: 1, y: 1, z: 1 } })

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
    let processor = new CanvasShaderProcessor({ fx })
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
    Compositor.component.layers.forEach(l => this.el.sceneEl.systems['settings-system'].download(l.canvas.toDataURL(), { extension: "png", suffix: i++ }, l.id))
  },
  bumpCanvasToNormalCanvasAction() {
    console.warn("Deprecated call to toolbox bumpCanvasToNormalCanvasAction")
    this.el.sceneEl.systems['normal-bump-drawing'].bumpCanvasToNormalCanvasAction()
  },
  defaultSpectatorAction() {
    console.warn("Deprecated call to toolbox defaultSpectatorAction")
    this.el.sceneEl.systems['camera-capture'].createDefaultSpectatorCamera()
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

    for (let i = 1; i < meshes.length; ++i) {
      let other = meshes[i]
      let geo = other.geometry.clone()
      geo.applyMatrix4(other.matrixWorld)
      geo.applyMatrix4(inv)
      geos.push(geo)
    }

    for (let geo of geos) {

    }

    mesh.geometry = THREE.BufferGeometryUtils.mergeBufferGeometries(geos, false)

    let obj = exporter.parse(mesh)
    this.el.sceneEl.systems['settings-system'].download("data:application/x-binary;base64," + btoa(obj), { extension: 'obj', suffix: '' })
  }
})

AFRAME.registerComponent('toolbox-click-action', {
  schema: { default: "" },
  events: {
    click: function (e) {
      this.el.sceneEl.querySelector('a-entity[toolbox-shelf]').components['toolbox-shelf'][this.data + "Action"]()
    }
  }
})

AFRAME.registerComponent('advanced-drawing-shelf', {
  events: {
    click: function (e) {
      if (e.target.hasAttribute('node-fx')) {
        this.el.sceneEl.querySelector('a-entity[toolbox-shelf]').components['toolbox-shelf'].applyFXAction(e.target.getAttribute('node-fx'))
        return
      }
    }
  }
})

Util.registerComponentSystem('normal-bump-drawing', {
  schema: {
    invert: { default: false },
    keepColor: { default: true },
  },
  bumpCanvasToNormalCanvasAction() {
    let shouldInvert = this.el.querySelector('#invert-normal-draw').getAttribute('toggle-button').toggled;
    let keepColor = this.el.querySelector('#color-normal-draw').getAttribute('toggle-button').toggled;
    Undo.collect(() => {
      Undo.pushCanvas(Compositor.drawableCanvas)
      bumpCanvasToNormalCanvas(Compositor.drawableCanvas, { normalCanvas: Compositor.drawableCanvas, bumpScale: Math.pow(Compositor.component.activeLayer.opacity, 2.2), invert: shouldInvert, alphaOnly: keepColor })
      Compositor.drawableCanvas.touch()
      if (Compositor.component.activeLayer.mode === 'bumpMap') {
        Compositor.component.activeLayer.opacity = 1.0
        Compositor.component.setLayerBlendMode(Compositor.component.activeLayer, 'normalMap')
        Compositor.drawableCanvas.touch()
      }
    })
  },
  drawNormal() {
    if (this.onEndDrawingCleanup) {
      this.onEndDrawingCleanup()
      return;
    }

    let normalLayer = Compositor.component.layerforMap('normalMap');
    let originalLayer = Compositor.component.activeLayer;

    if (!this.normalProcessor) {
      this.normalProcessor = new CanvasShaderProcessor({ source: require('./shaders/bump-to-normal-advanced.glsl') })
    }

    if (Compositor.el.getAttribute('material').shader === 'flat') {
      Compositor.el.setAttribute('material', 'shader', 'matcap')
    }

    let activeLayer = Compositor.component.addLayer(Compositor.component.layers.indexOf(normalLayer));
    let normalCtx = normalLayer.canvas.getContext('2d')
    let activeCtx = activeLayer.canvas.getContext('2d')
    let originalCtx = originalLayer.canvas.getContext('2d')

    let onLayerChanged = () => {
      this.onEndDrawingCleanup();
    }

    Compositor.el.addEventListener('layerupdated', onLayerChanged)

    this.onEndDrawing = () => {
      let shouldInvert = Compositor.component.data.flipNormal ? !this.data.invert
        : this.data.invert;
      let keepColor = this.data.keepColor;
      Undo.stack.pop()
      Undo.pushCanvas(normalLayer.canvas)
      if (keepColor) {
        originalCtx.drawImage(activeLayer.canvas, 0, 0)
      }
      this.normalProcessor.setInputCanvas(activeLayer.canvas)
      this.normalProcessor.setUniform('u_bumpScale', 'uniform1f', Math.pow(activeLayer.opacity, 2.2))
      this.normalProcessor.setUniform('u_invert', 'uniform1i', shouldInvert)
      this.normalProcessor.setUniform('u_alphaOnly', 'uniform1i', (keepColor && !this.el.sceneEl.systems['paint-system'].brush.textured) ? 1 : 0)
      this.normalProcessor.setCanvasAttribute('u_base', normalLayer.canvas)
      this.normalProcessor.update()

      normalCtx.globalCompositeOperation = 'source-over'
      normalCtx.drawImage(this.normalProcessor.canvas, 0, 0)
      activeCtx.clearRect(0, 0, activeLayer.canvas.width, activeLayer.canvas.height)
      normalLayer.canvas.touch()
      activeLayer.canvas.touch()
    };
    this.el.sceneEl.addEventListener('endcanvasdrawing', this.onEndDrawing);

    this.onEndDrawingCleanup = () => {
      Compositor.el.removeEventListener('layerupdated', onLayerChanged)
      this.el.sceneEl.removeEventListener('endcanvasdrawing', this.onEndDrawing)
      delete this.onEndDrawing
      Compositor.component.deleteLayer(activeLayer)
      delete this.onEndDrawingCleanup
    };
  },
})

Util.registerComponentSystem('cut-copy-system', {
  events: {
    shapecreated: function (e) {
      if (!this.cutoutStarted) return;

      this.cutoutStarted = false
      this.handleShape(e.detail)
    }
  },
  init() {
    this.cutBrush = new VectorBrush('vector')
  },
  handleShape(shape) {
    Undo.collect(() => {
      this.cutoutStarted = false
      shape.autoClose = true
      console.log("Handling shape", shape)

      let canvas = Compositor.drawableCanvas
      let baseLayer = Compositor.component.activeLayer
      let layer = new Layer(canvas.width, canvas.height);

      let dstCtx = layer.canvas.getContext('2d')

      dstCtx.beginPath()
      dstCtx.fillStyle = "#FFFFFFFF"
      dstCtx.moveTo(shape.curves[0].v1.x, - shape.curves[0].v1.y)
      for (let line of shape.curves) {
        dstCtx.lineTo(line.v2.x, - line.v2.y)
      }
      dstCtx.fill()
      dstCtx.stroke()

      let oldOpacity = baseLayer.opacity
      baseLayer.opacity = 1.0
      baseLayer.draw(dstCtx, Compositor.component.currentFrame, { mode: 'source-in' })

      if (this.cutShape) {
        let baseCtx = baseLayer.frame(Compositor.component.currentFrame).getContext('2d')
        let oldAlpha = baseCtx.globalAlpha
        let oldOperation = baseCtx.globalCompositeOperation
        baseCtx.globalAlpha = 1.0
        baseCtx.globalCompositeOperation = 'destination-out'
        baseCtx.fillStyle = "#FFFFFFFF"
        baseCtx.beginPath()
        baseCtx.moveTo(shape.curves[0].v1.x, - shape.curves[0].v1.y)
        for (let line of shape.curves) {
          baseCtx.lineTo(line.v2.x, - line.v2.y)
        }
        baseCtx.fill()
        baseCtx.globalAlpha = oldAlpha
        baseCtx.globalCompositeOperation = oldOperation
      }

      baseLayer.opacity = oldOpacity

      Compositor.component.addLayer(Compositor.component.layers.indexOf(Compositor.component.activeLayer), { layer })

      if (this.oldBrush) {
        this.el.sceneEl.systems['paint-system'].selectBrush(this.oldBrush)
        this.oldBrush = null
      }
    })
  },
  startCutout() {
    this.cutoutStarted = true
    this.oldBrush = this.el.sceneEl.systems['paint-system'].brush
    this.el.sceneEl.systems['paint-system'].selectBrush(this.cutBrush)
  },
  cut() {
    this.cutShape = true
    this.startCutout()
  },
  copy() {
    this.cutShape = false
    this.startCutout()
  },
  clear() {
    Undo.pushCanvas(Compositor.component.activeLayer.canvas)
    Compositor.component.activeLayer.canvas.getContext('2d').clearRect(0, 0, Compositor.component.activeLayer.canvas.width, Compositor.component.activeLayer.canvas.height)
    Compositor.component.activeLayer.touch()
  }
})

AFRAME.registerComponent('quick-access-row', {
  schema: {
    recording: { default: true },
    autoReset: { default: false },
  },
  init() {
    this.initialAddState = AFRAME.components['icon-button'].Component.prototype.addState;
    let self = this;
    this.interceptAddState = function (state) {
      if (state === STATE_PRESSED) {
        console.log("Intercepting", this.el)
        self.addButton(this.el)
      }
      self.initialAddState.call(this, state)
    }
  },
  update(oldData) {
    if (this.data.recording !== oldData.recording) {
      if (this.data.recording) {
        AFRAME.components['icon-button'].Component.prototype.addState = this.interceptAddState;
      }
      else {
        AFRAME.components['icon-button'].Component.prototype.addState = this.initialAddState;
      }
    }
  },
  addButton(el) {
    if (el.parentEl === this.el) return;
    if (el.hasAttribute('button-style') && el.getAttribute('button-style').buttonType === 'flat') return;
    if (!(el.hasAttribute('system-click-action') || el.hasAttribute('click-action'))) return;
    for (let b of this.el.getChildEntities()) {
      if (b.originalEl === el) return;
    }

    let newButton = document.createElement('a-entity')
    this.el.append(newButton)
    newButton.setAttribute('icon-button', el.getAttribute('icon-button'))
    newButton.setAttribute('tooltip', el.getAttribute('tooltip'))
    newButton.addEventListener('click', function (e) { el.emit('click', e.detail) })
    newButton.originalEl = el
  }
})
