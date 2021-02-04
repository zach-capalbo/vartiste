import {Pool} from './pool.js'
import {Util} from './util.js'
import {Undo} from './undo.js'
import {Layer} from './layer.js'
import CubemapToEquirectangular from './framework/CubemapToEquirectangular.js'
import {CAMERA_LAYERS} from './layer-modes.js'

AFRAME.registerSystem('camera-layers', {
  init() {
    this.CAMERA_LAYERS = CAMERA_LAYERS;
    this.camera_layers = {}
    for (let [name, val] of Object.entries(CAMERA_LAYERS))
    {
      this.camera_layers[name.toLowerCase().replace(/\_/g, '-')] = val
    }

    Util.whenLoaded(this.el, () => {
      this.el.sceneEl.camera.layers.enable(CAMERA_LAYERS.LEFT_EYE)
    })
  }
})

AFRAME.registerComponent('camera-layers', {
  schema: {
    layers: {type: 'array', default: ["default"]},
    throttle: {default: 500},
  },
  events: {
    object3dset: function() { this.refresh(); },
    'child-attached': function() { this.refresh(); }
  },
  update(oldData) {
    this.tick = AFRAME.utils.throttleTick(this.refresh, this.data.tick, this)
    let layers = this.el.object3D.layers
    layers.mask = 0
    for (let layer of this.data.layers)
    {
      let number = parseInt(layer)

      if (isNaN(number))
      {
        number = this.system.camera_layers[layer]
        if (isNaN(number))
        {
          console.error('No such layer', number)
          return
        }
      }

      layers.enable(number)
    }
    this.refresh()
  },
  refresh() {
    this.el.object3D.traverse(o => {
      o.layers.mask = this.el.object3D.layers.mask
    })
  },
  tick(t,dt) {
    this.refresh()
  }
})

AFRAME.registerSystem('camera-capture', {
  getTempCanvas() {
    let {width, height} = Compositor.component;

    if (this.tempCanvas) {
      if (this.tempCanvas.width !== width || this.tempCanvas.height !== height)
      {
        this.tempCanvas.width = width
        this.tempCanvas.height = height
      }
      return this.tempCanvas
    }

    this.tempCanvas = document.createElement('canvas')
    this.tempCanvas.width = width
    this.tempCanvas.height = height
    return this.tempCanvas
  },
  getTargetTempCanvas() {
    let {width, height} = Compositor.component;

    width *= 3
    height *= 3

    if (this.targetTempCanvas) {
      if (this.targetTempCanvas.width !== width || this.targetTempCanvas.height !== height)
      {
        this.targetTempCanvas.width = width
        this.targetTempCanvas.height = height
      }
      return this.targetTempCanvas
    }

    this.targetTempCanvas = document.createElement('canvas')
    this.targetTempCanvas.width = width
    this.targetTempCanvas.height = height
    return this.targetTempCanvas
  },
  captureToCanvas(camera, canvas) {
    if (!canvas) {
      canvas = this.getTempCanvas()
      canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height)
    }

    let renderer = this.el.sceneEl.renderer
    let wasXREnabled = renderer.xr.enabled
    renderer.xr.enabled = false

    let oldTarget = renderer.getRenderTarget()

    let {width, height} = canvas

    let targetTempCanvas = this.getTargetTempCanvas()

    let newTarget = new THREE.WebGLRenderTarget(targetTempCanvas.width, targetTempCanvas.height)

    newTarget.texture.encoding = renderer.outputEncoding
    renderer.setRenderTarget(newTarget)

    let ctx = targetTempCanvas.getContext('2d')

    renderer.render(this.el.sceneEl.object3D, camera);

    let data = ctx.getImageData(0, 0, targetTempCanvas.width, targetTempCanvas.height)

    renderer.readRenderTargetPixels(newTarget, 0, 0, targetTempCanvas.width, targetTempCanvas.height, data.data)

    ctx.putImageData(data, 0, 0)

    let destCtx = canvas.getContext('2d')

    destCtx.translate(0, canvas.height)
    destCtx.scale(1, -1)
    destCtx.drawImage(targetTempCanvas, 0, 0, canvas.width, canvas.height)
    destCtx.scale(1, -1)
    destCtx.translate(0, -canvas.height)

    renderer.xr.enabled = wasXREnabled

    renderer.setRenderTarget(oldTarget)
    newTarget.dispose()
    return canvas
  },
  capturePanorama() {
    var equiManaged = new CubemapToEquirectangular( this.el.sceneEl.renderer, true );
    equiManaged.update( document.querySelector('#camera').getObject3D('camera'), this.el.sceneEl.object3D );
  }
})

AFRAME.registerComponent('camera-tool', {
  dependencies: ['grab-activate', 'six-dof-tool'],
  schema: {
    orthographic: {default: false},
    fov: {default: 45.0},
    autoCamera: {default: true},
    near: {default: 0.1},
    far: {default: 10},
    preview: {default: true},
    previewThrottle: {default: 500},
    aspectAdjust: {default: 1.0},
    captureType: {oneOf: ['overlay', 'newFrame', 'newLayer', 'download', 'spectator'], default: 'overlay'},
    captureMaterial: {default: false},
  },
  events: {
    click: function(e) {
      if (this.data.captureMaterial)
      {
        this.takeMaterialPicture()
      }
      else
      {
        this.takePicture()
      }
    },
    activate: function() { this.activate() },
    stateadded: function(e) {
      if (e.detail === 'grabbed') this.el.sceneEl.systems['pencil-tool'].lastGrabbed = this
    }
  },
  init() {
    Pool.init(this)
    this.el.classList.add('grab-root')
    this.el.classList.add('clickable')
    this.el.setAttribute('grab-options', "showHand: false")

    const depth = 0.1
    const cameraWidth = 0.3

    Util.whenLoaded(Compositor.el, () => {
      if (!this.data.autoCamera) return

      let {width, height} = Compositor.el.getAttribute('geometry')
      Compositor.el.object3D.updateMatrixWorld()
      let scale = this.pool('scale', THREE.Vector3)
      scale.setFromMatrixScale(Compositor.el.object3D.matrixWorld)
      width = width * scale.x
      height = height * scale.y

      let camera;
      if (this.data.orthographic)
      {
        camera = new THREE.OrthographicCamera(-width / 2, width / 2, height / 2, - height / 2, 0.1, 10)
      }
      else
      {
        camera = new THREE.PerspectiveCamera(this.data.fov, width / height * this.data.aspectAdjust, this.data.near, this.data.far)
      }
      this.el.object3D.add(camera)

      this.camera = camera

      let body = document.createElement('a-entity')
      // body.setAttribute('depth', depth)
      // body.setAttribute('width', cameraWidth)
      // body.setAttribute('height', height / width * cameraWidth)
      body.setAttribute('gltf-model', '#asset-camera-body')
      body.setAttribute('scale', `${cameraWidth / 1.15} ${cameraWidth / 1.15} ${cameraWidth / 1.15}`)
      body.setAttribute('propogate-grab', "")
      body.setAttribute('position', `0 0 ${-depth / 2 - 0.001}`)
      body.setAttribute('material', 'src:#asset-shelf; metalness: 0.4; roughness: 0.6')
      body.setAttribute('apply-material-to-mesh', '')
      body.classList.add('clickable')
      this.el.append(body)

      if (!this.data.orthographic)
      {
        let fovLever = document.createElement('a-entity')
        fovLever.setAttribute('lever', `axis: x; valueRange: 0.1 180; initialValue: ${this.data.fov}`)
        fovLever.addEventListener('anglechanged', e => {
          this.data.fov = e.detail.value
          this.camera.fov = e.detail.value
          this.camera.updateProjectionMatrix()
          this.helper.update()
        })
        fovLever.setAttribute('scale', '0.3 0.3 0.3')
        fovLever.setAttribute('position', '0.14 0 -0.05')
        fovLever.setAttribute('tooltip', 'Adjust Field of View')
        fovLever.setAttribute('tooltip-style', 'rotation: 0 0 0; scale: 0.5 0.5 0.5')
        this.el.append(fovLever)

        let aspectLever = document.createElement('a-entity')
        aspectLever.setAttribute('lever', `axis: x; valueRange: 0.1 3; initialValue: ${this.data.aspectAdjust}`)
        aspectLever.addEventListener('anglechanged', e => {
          this.data.aspectAdjust = e.detail.value
          this.camera.aspect = Compositor.component.width / Compositor.component.height * e.detail.value
          this.camera.updateProjectionMatrix()
          this.helper.update()
        })
        aspectLever.setAttribute('scale', '0.3 0.3 0.3')
        aspectLever.setAttribute('position', '-0.14 0 -0.05')
        aspectLever.setAttribute('rotation', '0 180 0')
        aspectLever.setAttribute('tooltip', 'Adjust Aspect Ratio')
        aspectLever.setAttribute('tooltip-style', 'rotation: 0 180 0; scale: 0.5 0.5 0.5')
        this.el.append(aspectLever)

        let farLever = document.createElement('a-entity')
        farLever.setAttribute('lever', `axis: z; valueRange: 10 0.1; initialValue: ${this.data.far}`)
        if (this.data.far === 10)
        {
          let value = this.el.sceneEl.camera.far
          this.data.far = value
          this.camera.far = value
          this.camera.updateProjectionMatrix()
        };
        farLever.addEventListener('anglechanged', e => {
          let {value} = e.detail
          if (e.detail.percent <= 0.1)
          {
            value = this.el.sceneEl.camera.far
          }
          this.data.far = value
          this.camera.far = value
          this.camera.updateProjectionMatrix()
          this.helper.update()
        })
        farLever.setAttribute('scale', '0.3 0.3 0.3')
        farLever.setAttribute('position', '0.1 0 -0.0')
        farLever.setAttribute('tooltip', 'Adjust Far Plane')
        farLever.setAttribute('tooltip-style', 'rotation: 0 0 0; scale: 0.5 0.5 0.5')
        this.el.append(farLever)
      }

      Compositor.el.addEventListener('resized', (e) => {
        if (!this.data.autoCamera) return

        let {width, height} = e.detail
        this.camera.aspect = Compositor.component.width / Compositor.component.height * this.data.aspectAdjust
        this.camera.updateProjectionMatrix()

        if (this.helper) this.helper.update()
      })
    })

    this.tick = AFRAME.utils.throttleTick(this.tick, this.data.previewThrottle, this)
  },
  update(oldData) {
    if (this.data.captureType !== oldData.captureType && this.data.captureType === 'spectator')
    {
      this.toggleSpectator()
    }
  },
  takePicture() {
    console.log("Taking picture")
    if (this.data.captureType === 'spectator')
    {
      return;
    }

    if (this.data.captureType === 'newLayer')
    {
      Compositor.component.addLayer()
    }
    else if (this.data.captureType === 'newFrame')
    {
      Compositor.component.addFrameAfter()
    }
    let targetCanvas
    if (this.data.captureType === 'download')
    {
      targetCanvas = document.createElement('canvas')
      targetCanvas.width = Compositor.component.width
      targetCanvas.height = Compositor.component.height
    }
    else
    {
      targetCanvas = Compositor.component.activeLayer.frame(Compositor.component.currentFrame)
      Undo.pushCanvas(targetCanvas)
    }
    this.el.sceneEl.emit("startsnap", {source: this.el})
    this.helper.visible = false
    this.el.sceneEl.systems['camera-capture'].captureToCanvas(this.camera, targetCanvas)
    Compositor.component.activeLayer.touch()
    this.helper.visible = true
    this.el.sceneEl.emit("endsnap", {source: this.el})
    if (this.data.captureType === 'download')
    {
      let settings = this.el.sceneEl.systems['settings-system']
      settings.download(targetCanvas.toDataURL(settings.imageURLType(), settings.compressionQuality()), {extension: settings.imageExtension(), suffix: "snapshot"}, "Snapshot")
    }
  },
  takeMaterialPicture() {
    let startingActiveLayer = Compositor.component.activeLayer
    let originalMaterials = new Map()
    let colorOnlyMaterials = new Map()
    this.el.sceneEl.object3D.traverseVisible(o => {
      if (o.material && (o.material.type === "MeshBasicMaterial" || o.material.type === "MeshStandardMaterial" || o.material.type === "MeshMatcapMaterial")) {
        originalMaterials.set(o, o.material)
      }
      else if (o.material)
      {
        colorOnlyMaterials.set(o, o.material)
      }
    })

    for (let [o, m] of originalMaterials.entries())
    {
      o.material = new THREE.MeshBasicMaterial({
        color: m.color,
        map: m.map,
        side: m.side,
        transparent: m.transparent,
        opacity: m.opacity,
      })
    }

    this.takePicture()

    for (let o of colorOnlyMaterials.keys())
    {
      o.visible = false
    }

    const HANDLED_MAPS = [
      {map: 'metalnessMap', value: 'metalness'},
      {map: 'roughnessMap', value: 'roughness'},
      {map: 'normalMap', value: 'normalScale'},]

    for (let {map, value} of HANDLED_MAPS)
    {
      let layer = Compositor.component.layers.find(l => l.mode === map)
      if (!layer)
      {
        layer = new Layer(Compositor.component.width, Compositor.component.height)
        Compositor.component.addLayer(0, {layer})
        Compositor.component.setLayerBlendMode(layer, map)
      }
      Compositor.component.activateLayer(layer)
      Util.fillDefaultCanvasForMap(layer.frame(Compositor.component.currentFrame), map, {replace: !this.keepExistingMaterials})

      for (let [o, m] of originalMaterials.entries())
      {
        if (map === "normalMap")
        {
          o.material = new THREE.MeshNormalMaterial({
            normalMap: m.normalMap || null,
            normalMapType: m.normalMapType,
            normalScale: m.normalScale,
            side: m.side,
            transparent: m.transparent,
          })
        }
        else
        {
          o.material = new THREE.MeshBasicMaterial({
            color: new THREE.Color(m[value], m[value], m[value]),
            map: m[map],
            side: m.side,
            transparent: m.transparent,
            opacity: m.opacity,
            visible: m.type === 'MeshStandardMaterial'
          })
        }
      }

      if (this.keepExistingMaterials && map === 'normalMap')
      {
        this.el.sceneEl.systems['canvas-fx'].applyFX('swizzle')
      }

      this.takePicture()

      if (map === "normalMap")
      {
        this.el.sceneEl.systems['canvas-fx'].applyFX('swizzle')
      }

      layer.touch()
    }

    for (let [o, m] of originalMaterials.entries())
    {
      o.material = m
    }

    for (let o of colorOnlyMaterials.keys())
    {
      o.visible = true
    }

    Compositor.component.activateLayer(startingActiveLayer)
  },
  activate() {
    var helper = new THREE.CameraHelper( this.camera );
    this.helper = helper
    this.el.sceneEl.object3D.add( helper );
    this.helper.layers.disable(0)
    this.helper.layers.enable(CAMERA_LAYERS.LEFT_EYE)
    this.helper.layers.enable(CAMERA_LAYERS.RIGHT_EYE)
    this.helper.traverse(o => {
      o.layers.disable(0)
      o.layers.enable(CAMERA_LAYERS.LEFT_EYE)
      o.layers.enable(CAMERA_LAYERS.RIGHT_EYE)
    })

    if ((this.el.getAttribute('action-tooltips').trigger || "Summon ").startsWith("Summon"))
    {
      this.el.setAttribute('action-tooltips', 'trigger: Take Picture')
    }

    if (this.data.autoCamera && this.data.preview && !this.preview)
    {
      let cameraWidth = 0.3
      let preview = document.createElement('a-entity')

      if (this.data.orthographic)
      {
        preview.setAttribute('geometry', `primitive: plane; width: ${cameraWidth}; height: ${cameraWidth / (this.camera.right - this.camera.left) * (this.camera.top - this.camera.bottom)}`)
      }
      else
      {
        preview.setAttribute('geometry', `primitive: plane; width: ${cameraWidth}; height: ${cameraWidth / this.camera.aspect}`)
      }
      preview.setAttribute('position', `0 -${cameraWidth / 2} 0`)
      preview.setAttribute('frame', 'closable: false; pinnable: false')
      let previewCanvas = document.createElement('canvas')
      previewCanvas.width = 256
      previewCanvas.height = previewCanvas.width * this.camera.aspect
      this.previewCanvas = previewCanvas
      this.previewCtx = previewCanvas.getContext('2d')
      this.previewCtx.fillStyle = '#333'
      this.preview = preview
      preview.setAttribute('material', {src: previewCanvas, npot: true, side: 'double'})
      this.el.append(preview)
    }

    if (this.data.autoCamera)
    {
      let row = document.createElement('a-entity')
      row.setAttribute('icon-row', '')
      row.setAttribute('scale', '0.1 0.1 0.1')
      row.setAttribute('position', `-0.11 0 -0.01`)
      row.addEventListener('click', function(e) {
        e.stopPropagation()
        e.preventDefault()
        return true
      })
      this.el.append(row)

      for (let [icon, prop, tip] of [
        ['#asset-brush', 'overlay', "Overlay Current Layer"],
        ['#asset-plus-box-outline', 'newLayer', "New Layer On Capture"],
        ['#asset-arrow-right', 'newFrame', "New Frame On Capture"],
        ['#asset-floppy', 'download', "Download Snapshot"],
        ['#asset-camera', 'spectator', "Spectator Camera"]
      ])
      {
        let button = document.createElement('a-entity')
        row.append(button)
        button.setAttribute('icon-button', icon)
        button.setAttribute('radio-button', {target: this.el, component: 'camera-tool', property: 'captureType', value: prop})
        button.setAttribute('tooltip', tip)
      }

      row = document.createElement('a-entity')
      this.el.append(row)
      row.setAttribute('scale', '0.1 0.1 0.1')
      row.setAttribute('position', `-0.11 -0.05 -0.01`)
      row.addEventListener('click', function(e) {
        e.stopPropagation()
        e.preventDefault()
        return true
      })

      let button = document.createElement('a-entity')
      row.append(button)
      button.setAttribute('icon-button', '#asset-brightness-4')
      button.setAttribute('tooltip', 'Capture Material Textures')
      button.setAttribute('toggle-button', {target: this.el, component: 'camera-tool', property: 'captureMaterial'})
    }
    this.activate = function(){};
  },
  createLockedClone() {
    let clone = document.createElement('a-entity')
    clone.setAttribute('camera-tool', this.el.getAttribute('camera-tool'))
    clone.setAttribute('six-dof-tool', {lockedClone: true, lockedComponent: 'camera-tool'})
    this.el.parentEl.append(clone)
    Util.whenLoaded(clone, () => {
      Util.positionObject3DAtTarget(clone.object3D, this.el.object3D)
    })
  },
  toggleSpectator() {
    let system = this.el.sceneEl.systems['spectator-camera']

    system.data.camera = this.camera
    system.data.state = SPECTATOR_CAMERA
  },
  tick(t,dt) {
    if (!this.preview) return;
    if (!(this.el.is("grabbed") || this.el.is('cursor-hovered'))) return;

    if (this.data.orthographic)
    {
      Util.ensureSize(this.previewCanvas, 255, 255 / (this.camera.right - this.camera.left) * (this.camera.top - this.camera.bottom))
    }
    else
    {
      Util.ensureSize(this.previewCanvas, 256, 256 * this.camera.aspect)
    }

    this.previewCtx.fillRect(0, 0, this.previewCanvas.width, this.previewCanvas.height)
    this.el.sceneEl.emit("startsnap", {source: this.el})
    this.helper.visible = false
    this.el.sceneEl.systems['camera-capture'].captureToCanvas(this.camera, this.previewCanvas)
    this.helper.visible = true
    this.el.sceneEl.emit("endsnap", {source: this.el})
    this.preview.getObject3D('mesh').material.map.needsUpdate = true
  }
})

AFRAME.registerSystem('spray-can-tool', {
  setSprayResolution(width, height) {
    this.el.sceneEl.querySelectorAll('*[spray-can-tool]').forEach(el => {
      if (el.getAttribute('spray-can-tool').locked) return

      el.setAttribute('spray-can-tool', 'canvasSize', `${width} ${height}`)
    })
  },
  setSprayResolutionLow() {
    this.setSprayResolution(24, 24)
  },
  setSprayResolutionMedium() {
    this.setSprayResolution(64, 64)
  },
  setSprayResolutionHigh() {
    this.setSprayResolution(256, 256)
  },
  setSprayResolutionCanvas() {
    this.setSprayResolution(Compositor.component.width, Compositor.component.height)
  }
})

AFRAME.registerComponent('spray-can-tool', {
  dependencies: ['camera-tool'],
  schema: {
    locked: {default: false},
    projector: {default: false},
    materialProjector: {default: false},
    canvasSize: {type: 'vec2', default: {x: 64, y: 64}},

    brush: {default: undefined, type: 'string', parse: o => o},
    paintSystemData: {default: undefined, type: 'string', parse: o => o},
    lockedColor: {type: 'color'}
  },
  events: {
    'stateadded': function(e) {
      if (e.detail === 'grabbed') {
        this.el.sceneEl.systems['pencil-tool'].lastGrabbed = this
        this.updateBrushSize()
      }
    }
  },
  init() {
    Pool.init(this)
    this.el.setAttribute('camera-tool', {autoCamera: false})
    this.takePicture = this.takePicture.bind(this.el.components['camera-tool'])
    this.el.components['camera-tool'].takePicture = this.takePicture;
    this.el.setAttribute('action-tooltips', 'trigger: Spray Paint');

    ;(function(self) {
      this.cameraCanvas = document.createElement('canvas')
      this.cameraCanvas.width = self.data.canvasSize.x
      this.cameraCanvas.height = self.data.canvasSize.y
      this.targetCanvas = document.createElement('canvas')
      this.targetCanvas.width = 1024
      this.targetCanvas.height = 512
      this.sprayCanTool = self

      let camera = new THREE.PerspectiveCamera(5, 1, 0.1, 1)
      camera.layers.set(CAMERA_LAYERS.SPRAY_PAINT_MASK)
      this.el.object3D.add(camera)
      this.camera = camera

      let body = document.createElement('a-cylinder')
      body.setAttribute('radius', 0.1)
      body.setAttribute('height', 0.3)
      body.setAttribute('propogate-grab', "")
      body.setAttribute('segments-radial', 10)
      body.setAttribute('segments-height', 1)
      body.setAttribute('position', `0 -.17 ${-0.1 / 2 - 0.001}`)
      body.setAttribute('material', 'src:#asset-shelf; metalness: 0.7; side: double')
      body.classList.add('clickable')
      this.el.append(body)
      this.captureToCanvas = self.captureToCanvas
      self.updateBrushSize = self.updateBrushSize.bind(this)
      this.updateBrushSize = self.updateBrushSize

      this.keepExistingMaterials = true

      this.wasDrawing = false

      this.el.sceneEl.addEventListener('brushscalechanged', () => {
        this.savedBrush = undefined
        if (this.el.is("grabbed"))
        {
          this.updateBrushSize()
        }
      })
    }).call(this.el.components['camera-tool'], this)

    this.tick = AFRAME.utils.throttleTick(this.tick, 10, this)
  },
  update(oldData)
  {
    (function(self) {
      let updateProjector = false
      this.data.projector = self.data.projector
      this.data.materialProjector = self.data.materialProjector

      if (this.data.projector)
      {
        this.data.near = 0.2
      }

      // console.log("DATA", self.data.canvasSize,  oldData.canvasSize, this.cameraCanvas, this.projectorCanvas)

      if (!oldData.canvasSize || (self.data.canvasSize && (self.data.canvasSize.x !== oldData.canvasSize.x || self.data.canvasSize.y !== oldData.canvasSize.y)))
      {
        this.cameraCanvas.width = self.data.canvasSize.x
        this.cameraCanvas.height = self.data.canvasSize.y
        delete this.buffer
        delete this.savedBrush
        delete this.newTarget
        updateProjector = true
      }

      if (this.data.projector !== oldData.projector && this.data.projector && !this.projectorCanvas)
      {
        this.projectorCanvas = document.createElement('canvas')
        updateProjector = true
      }

      if (updateProjector && this.projectorCanvas) {
        this.projectorCanvas.width = this.cameraCanvas.width
        this.projectorCanvas.height = this.cameraCanvas.height
        this.projectorData = this.projectorCanvas.getContext('2d').getImageData(0, 0, this.projectorCanvas.width, this.projectorCanvas.height)
      }
    }).call(this.el.components['camera-tool'], this)
  },
  updateBrushSize() {
    let brush = this.sprayCanTool.data.locked ? this.sprayCanTool.brush : this.el.sceneEl.systems['paint-system'].brush
    if (this.savedBrush != brush)
    {
      this.savedBrush = brush

      if (!brush.overlayCanvas)
      {
        console.error("Cannot spray paint brush with no canvas")
        delete this.savedBrush
        return false
      }

      this.brushData = brush.overlayCanvas.getContext("2d").getImageData(0, 0, brush.width, brush.height)

      this.camera.fov = 5 * brush.width / brush.baseWidth
      this.camera.aspect = brush.width / brush.height
      this.camera.near = this.data.near
      this.camera.updateProjectionMatrix()

      this.helper.update()
      // this.cameraCanvas.width = Math.round(brush.width)
      // this.cameraCanvas.height = Math.round(brush.height)
    }
    return true
  },
  captureToCanvas(camera, canvas, data) {
    let renderer = this.el.sceneEl.renderer
    let wasXREnabled = renderer.xr.enabled
    renderer.xr.enabled = false

    let oldTarget = renderer.getRenderTarget()

    let {width, height} = canvas

    if (!this.newTarget) {
      this.newTarget = new THREE.WebGLRenderTarget(width, height)
    }
    let newTarget = this.newTarget

    newTarget.texture.encoding = renderer.outputEncoding

    renderer.setRenderTarget(newTarget)

    renderer.render(this.el.sceneEl.object3D, camera);

    renderer.readRenderTargetPixels(newTarget, 0, 0, width, height, data.data)

    renderer.xr.enabled = wasXREnabled

    renderer.setRenderTarget(oldTarget)

    return data
  },
  takePicture() {
    let startTime = Date.now()
    // console.log("Taking picture")
    // this.el.sceneEl.emit("startsnap", {source: this.el})
    this.helper.visible = false

    let brush = this.sprayCanTool.data.locked ? this.sprayCanTool.brush : this.el.sceneEl.systems['paint-system'].brush
    let color = brush.color3

    // console.log("Using brush", this.sprayCanTool.data.locked, brush)

    let oldMaterial = Compositor.material
    let shaderMaterial = this.shaderMaterial

    if (!shaderMaterial)
    {
      this.shaderMaterial = new THREE.ShaderMaterial({
        fragmentShader: require('./shaders/uv-index.glsl'),
        vertexShader: require('./shaders/pass-through.vert')
      })
      shaderMaterial = this.shaderMaterial
    }

    Compositor.meshRoot.traverse(o =>
      {
        if (o.type === 'Mesh' || o.type === 'SkinnedMesh')
        {
          o.material = shaderMaterial
          o.layers.enable(CAMERA_LAYERS.SPRAY_PAINT_MASK)
        }
      })

    if (this.data.projector) {
      document.getElementById('world-root').object3D.traverse(o => {
        if (o.type === 'Mesh' || o.type === 'SkinnedMesh')
        {
          if (!(o.layers.test(this.camera.layers))) {
            o.layers.enable(CAMERA_LAYERS.PROJECTOR_MASK)
          }
        }
      })

      if (this.data.materialProjector)
      {
        Compositor.meshRoot.traverse(o =>
          {
            if (o.type === 'Mesh' || o.type === 'SkinnedMesh')
            {
              o.material = shaderMaterial
              o.layers.disable(CAMERA_LAYERS.PROJECTOR_MASK)
            }
          })
      }
    }

    // this.cameraCanvas.clearRect(0, 0, this.cameraCanvas.width, this.cameraCanvas.height)
    let capturedImage = this.cameraCanvas

    // let pictureTime = Date.now() - startTime

    if (!this.buffer) {
      this.buffer = this.cameraCanvas.getContext("2d").getImageData(0, 0, this.cameraCanvas.width, this.cameraCanvas.height)
    }

    // TODO: Shaderize this
    let capturedData = this.captureToCanvas(this.camera, this.cameraCanvas, this.buffer)
    let targetCanvas = this.targetCanvas
    let finalDestinationCanvas = Compositor.component.activeLayer.frame(Compositor.component.currentFrame)

    Compositor.meshRoot.traverse(o =>
      {
        if (o.type === 'Mesh' || o.type === 'SkinnedMesh')
        {
          o.material = oldMaterial
        }
      })

    let projectorData
    if (this.data.projector)
    {
      this.camera.layers.set(CAMERA_LAYERS.PROJECTOR_MASK)
      projectorData = this.captureToCanvas(this.camera, this.projectorCanvas, this.projectorData).data
      this.camera.layers.set(CAMERA_LAYERS.SPRAY_PAINT_MASK)
    }

    if (targetCanvas.width !== finalDestinationCanvas.width || targetCanvas.height !== finalDestinationCanvas.height)
    {
      console.log("Resizing target canvas")
      targetCanvas.width = finalDestinationCanvas.width
      targetCanvas.height = finalDestinationCanvas.height
    }

    if (!this.targetContext)
    {
      this.targetContext = targetCanvas.getContext("2d")
    }
    let {targetContext} = this
    // targetContext.clearRect(0, 0, targetCanvas.width, targetCanvas.height)

    if (!this.targetData)
    {
      this.targetData = targetContext.getImageData(0, 0, targetCanvas.width, targetCanvas.height)
    }

    let targetData = this.targetData

    if (!this.updateBrushSize())
    {
      return
    }

    let brushData = this.brushData

    // let imageDataTime = Date.now() - startTime - pictureTime
    var x,y,r,g,b,a,bx,by,u,v,xx,yy,len,angle;

    let flipY = Compositor.component.data.flipY

    if (!this.touchedPixels)
    {
      this.touchedPixels = {}
    }

    let touchedPixels = this.touchedPixels

    let rotation = 2*Math.PI*Math.random()

    let projectorColor = this.pool("projectorColor", THREE.Color)

    for (y = 0; y < capturedImage.height; y++)
    {
      for (x = 0; x < capturedImage.width; x++)
      {
        r = capturedData.data[((y * capturedImage.width) + x) * 4 + 0]
        g = capturedData.data[((y * capturedImage.width) + x) * 4 + 1]
        b = capturedData.data[((y * capturedImage.width) + x) * 4 + 2]
        a = capturedData.data[((y * capturedImage.width) + x) * 4 + 3]

        bx = Math.floor(x / capturedImage.width * brush.width)
        by = Math.floor(y / capturedImage.height * brush.height)

        if (brush.autoRotate)
        {
          bx = x / capturedImage.width
          by = y / capturedImage.height
          len = Math.sqrt((bx - 0.5) * (bx - 0.5) + (by - 0.5) * (by - 0.5))
          angle = Math.atan2(by - 0.5, bx - 0.5)
          angle -= rotation
          bx = Math.floor((len * Math.cos(angle) + 0.5) * brush.width)
          by = Math.floor((len * Math.sin(angle) + 0.5) * brush.height)
        }

        u = (((b & 0xF0) >> 4) * 256 + r) / 4096
        v = ((b & 0x0F) * 256 + g) / 4096
        v = flipY ? 1.0 - v : v

        xx = Math.round(u * targetCanvas.width) // + Math.random() - 0.5)
        yy = Math.round(v * targetCanvas.height) // + Math.random() - 0.5)

        touchedPixels[((yy * targetCanvas.width) + xx) * 4] = true

        if (this.data.projector)
        {
          projectorColor.setRGB(projectorData[((y * capturedImage.width) + x) * 4 + 0] / 255.0, projectorData[((y * capturedImage.width) + x) * 4 + 1] / 255.0, projectorData[((y * capturedImage.width) + x) * 4 + 2] / 255.0)
          // projectorColor.convertSRGBToLinear()
          targetData.data[((yy * targetCanvas.width) + xx) * 4 + 0] = Math.round(projectorColor.r * 255)
          targetData.data[((yy * targetCanvas.width) + xx) * 4 + 1] = Math.round(projectorColor.g * 255)
          targetData.data[((yy * targetCanvas.width) + xx) * 4 + 2] = Math.round(projectorColor.b * 255)
          targetData.data[((yy * targetCanvas.width) + xx) * 4 + 3] += brushData.data[((by * brush.overlayCanvas.width) + bx) * 4 + 3] * projectorData[((y * capturedImage.width) + x) * 4 + 3] / 255.0
        }
        else
        {
          targetData.data[((yy * targetCanvas.width) + xx) * 4 + 0] = brush.color3.r * 255
          targetData.data[((yy * targetCanvas.width) + xx) * 4 + 1] = brush.color3.g * 255
          targetData.data[((yy * targetCanvas.width) + xx) * 4 + 2] = brush.color3.b * 255
          targetData.data[((yy * targetCanvas.width) + xx) * 4 + 3] += brushData.data[((by * brush.overlayCanvas.width) + bx) * 4 + 3] * a / 255.0
        }
      }
    }
    // let mathTime = Date.now() - startTime - pictureTime - imageDataTime
    targetContext.putImageData(targetData, 0, 0)

    let finalContext = finalDestinationCanvas.getContext("2d")
    let oldAlpha = finalContext.globalAlpha
    finalContext.globalAlpha = brush.opacity
    finalContext.drawImage(targetCanvas, 0, 0)
    finalContext.globalAlpha = oldAlpha

    Compositor.component.activeLayer.touch()

    let pixelToClear

    if (this.data.projector)
    {
      for (pixelToClear in this.touchedPixels)
      {
        pixelToClear = parseInt(pixelToClear)
        projectorData[pixelToClear  + 0] = 0
        projectorData[pixelToClear  + 1] = 0
        projectorData[pixelToClear  + 2] = 0
        projectorData[pixelToClear  + 3] = 0
      }
    }

    for (pixelToClear in this.touchedPixels)
    {
      pixelToClear = parseInt(pixelToClear)
      targetData.data[pixelToClear  + 0] = 0
      targetData.data[pixelToClear  + 1] = 0
      targetData.data[pixelToClear  + 2] = 0
      targetData.data[pixelToClear  + 3] = 0
      delete this.touchedPixels[pixelToClear]
    }

    // let drawTime = Date.now() - startTime - pictureTime

    this.helper.visible = true
    // this.el.sceneEl.emit("endsnap", {source: this.el})

    // console.log("Took", Date.now() - startTime, pictureTime, drawTime, imageDataTime, mathTime)
  },
  tick(t, dt) {
    let initialWasDrawing = this.wasDrawing
    this.wasDrawing = false
    if (!this.el.components['camera-tool'].helper) return
    if (!this.el.is("grabbed")) return
    if (!this.el.grabbingManipulator) return
    if (!this.el.grabbingManipulator.el.hasAttribute('mouse-manipulator') && !this.el.grabbingManipulator.el.components['hand-draw-tool'].isDrawing) return

    if (!initialWasDrawing)
    {
      Undo.pushCanvas(Compositor.drawableCanvas)
    }
    if (this.data.materialProjector)
    {
      this.el.components['camera-tool'].takeMaterialPicture()
    }
    else
    {
      this.takePicture()
    }
    this.wasDrawing = true
  },
  createLockedClone() {
    let clone = document.createElement('a-entity')
    clone.setAttribute('camera-tool', {autoCamera: false})
    this.el.parentEl.append(clone)
    clone.setAttribute('spray-can-tool', 'locked: true')
    clone.setAttribute('six-dof-tool', {lockedClone: true, lockedComponent: 'spray-can-tool'})
    Util.whenLoaded(clone, () => {
      Util.positionObject3DAtTarget(clone.object3D, this.el.object3D)
      let newComponent = clone.components['spray-can-tool']
      newComponent.brush = this.el.sceneEl.systems['paint-system'].brush.clone()
    })
  }
})


AFRAME.registerComponent('eye-drop-tool', {
  dependencies: ['camera-tool'],
  schema: {
    locked: {default: false}
  },
  events: {
    'stateadded': function(e) {
      // if (e.detail === 'grabbed') this.el.sceneEl.systems['pencil-tool'].lastGrabbed = this
    }
  },
  init() {
    Pool.init(this)
    this.el.setAttribute('camera-tool', {autoCamera: false})
    this.takePicture = this.takePicture.bind(this.el.components['camera-tool'])
    this.el.components['camera-tool'].takePicture = this.takePicture;

    (function(self) {
      this.cameraCanvas = document.createElement('canvas')
      this.cameraCanvas.width = 64
      this.cameraCanvas.height = 64

      this.eyeDropTool = self

      let width = 0.07
      let camera = new THREE.OrthographicCamera( - width / 2, width / 2, width / 2, - width / 2, 0.2, 1)
      this.el.object3D.add(camera)
      this.camera = camera

      let body = document.createElement('a-sphere')
      body.setAttribute('radius', 0.07)
      body.setAttribute('propogate-grab', "")
      body.setAttribute('segments-radial', 8)
      body.setAttribute('segments-height', 8)
      body.setAttribute('position', `0 0 ${-0.1 / 2 - 0.001}`)
      body.setAttribute('material', "side: double")
      body.setAttribute('show-current-color', "")
      Util.whenLoaded(body, () => body.setAttribute('material', {shader: 'standard'}))
      body.classList.add('clickable')
      this.el.append(body)

      // this.el.sceneEl.addEventListener('brushscalechanged', () => {
      //   this.savedBrush = undefined
      // })
    }).call(this.el.components['camera-tool'], this)

    this.tick = AFRAME.utils.throttleTick(this.tick, 10, this)
  },
  takePicture() {
    let startTime = Date.now()
    console.log("Sampling Color picture")
    this.el.sceneEl.emit("startsnap", {source: this.el})
    this.helper.visible = false

    let targetCanvas = this.cameraCanvas
    let targetContext = targetCanvas.getContext("2d")

    targetContext.clearRect(0, 0, targetCanvas.width, targetCanvas.height)
    this.el.sceneEl.systems['camera-capture'].captureToCanvas(this.camera, targetCanvas)

    let imageData = targetContext.getImageData(0, 0, targetCanvas.width, targetCanvas.height)

    let avg = {r:0.0, g:0.0, b:0.0, alpha: 0}
    let {height, width} = targetCanvas
    for (let j = 0; j < targetCanvas.height; j++)
    {
      for (let i = 0; i < targetCanvas.width; i++)
      {
        avg.r += imageData.data[4*(j * width + i) + 0] / 255 * imageData.data[4*(j * width + i) + 3] / 255.0
        avg.g += imageData.data[4*(j * width + i) + 1] / 255 * imageData.data[4*(j * width + i) + 3] / 255.0
        avg.b += imageData.data[4*(j * width + i) + 2] / 255 * imageData.data[4*(j * width + i) + 3] / 255.0
        avg.alpha += imageData.data[4*(j * width + i) + 3] / 255.0
      }
    }

    if (avg.alpha > 0.00001)
    {
      avg.r /= avg.alpha
      avg.g /= avg.alpha
      avg.b /= avg.alpha
    }
    else
    {
      avg.r = 0
      avg.g = 0
      avg.b = 0
    }

    this.helper.visible = true
    this.el.sceneEl.emit("endsnap", {source: this.el})

    let color = `rgba(${Math.round(avg.r * 255)}, ${Math.round(avg.g * 255)}, ${Math.round(avg.b * 255)}, 1.0)`
    this.el.sceneEl.systems['paint-system'].selectColor(color)

    // console.log("Took", Date.now() - startTime, pictureTime, drawTime, imageDataTime, mathTime)
  },
  tick(t, dt) {
    if (!this.el.components['camera-tool'].helper) return
    if (!this.el.is("grabbed")) return
    if (!this.el.grabbingManipulator) return
    if (!this.el.grabbingManipulator.el.hasAttribute('mouse-manipulator') && !this.el.grabbingManipulator.el.components['hand-draw-tool'].isDrawing) return
    this.takePicture()
  }
})

// Spectator camera using pixel copying
AFRAME.registerComponent('slow-spectator-camera', {
  dependencies: ['grab-activate'],
  schema: {
    fps: {default: 15},
  },
  events: {
    activate: function() { this.activate(); }
  },
  init() {
    // this.activate()
  },
  update() {
    this.tick = AFRAME.utils.throttleTick(this._tick, Math.round(1000.0 / this.data.fps), this)
  },
  activate() {
    let canvas = document.createElement('canvas')
    canvas.width = 256
    canvas.height = 256
    canvas.classList.add("spectator-canvas")
    document.body.append(canvas)
    this.canvas = canvas

    let camera = new THREE.PerspectiveCamera(45.0, 2.0, 0.1, 10000)
    this.el.object3D.add(camera)
    this.camera = camera

    let renderTarget = new THREE.WebGLRenderTarget(canvas.width, canvas.height)
    this.renderTarget = renderTarget

    // let preview = document.createElement('a-plane')
    // preview.setAttribute('material', 'shader: flat; color: #fff')
    // preview.setAttribute('frame', '')
    // this.el.append(preview)
    // this.preview = preview
  },
  tick (t,dt) {},
  _tick(t, dt)
  {
    if (!this.camera) return

    // if (!this.preview.hasLoaded) return

    this.el.sceneEl.systems['camera-capture'].captureToCanvas(this.camera, this.canvas)

    // let renderer = this.el.sceneEl.renderer
    // let wasXREnabled = renderer.xr.enabled
    // renderer.xr.enabled = false
    //
    // let oldTarget = renderer.getRenderTarget()
    //
    // renderer.setRenderTarget(this.renderTarget)
    //
    // renderer.render(this.el.sceneEl.object3D, this.camera);
    //
    // renderer.xr.enabled = wasXREnabled
    //
    // renderer.setRenderTarget(oldTarget)
  }
})

const [
  SPECTATOR_NONE,
  SPECTATOR_MIRROR,
  SPECTATOR_CAMERA
] = [
  "SPECTATOR_NONE",
  "SPECTATOR_MIRROR",
  "SPECTATOR_CAMERA"
];

// WebXR compatible spectator camera. Can be set to one of three states:
//
// 1. `SPECTATOR_NONE` - Default state. No specator camera, and uses A-Frame's
// default behavior.
// 2. `SPECTATOR_MIRROR` - Mirror's the VR user's left-eye display to the main
// A-FRAME canvas
// 3. `SPECTATOR_CAMERA` - Displays a view from a stationary camera. (Specified
// by the `camera` property)
Util.registerComponentSystem('spectator-camera', {
  schema: {
    // Current operating state
    state: {type: 'string', default: SPECTATOR_NONE, oneOf: [SPECTATOR_NONE, SPECTATOR_CAMERA, SPECTATOR_MIRROR]},
    // Camera to use when state is `SPECTATOR_CAMERA`
    camera: {type: 'selector', default: '#camera'},
    // Use this to throttle spectator rendering for performance or other reasons
    throttle: {default: 0}
  },
  init() {
    Pool.init(this)
    this.gl = this.el.sceneEl.canvas.getContext('webgl2')

    this.fakeNotSceneProxy = new Proxy({}, {
      get: (target, prop, receiver) => {
        if (prop === "isScene") {
          return false;
        }
        return Reflect.get(this.el.sceneEl.object3D, prop, receiver);
      }
    })
  },
  update(oldData) {
    this.tock = AFRAME.utils.throttleTick(this._tock, this.data.throttle, this)
  },
  tock(t,dt) {},
  _tock(t,dt) {
    if (!navigator.xr) return
    if (!this.el.sceneEl.renderer.xr) return;
    if (!this.el.sceneEl.renderer.xr.enabled) return;

    let xrSession = this.el.sceneEl.renderer.xr.getSession();
    if (!xrSession) return;

    if (this.data.state === SPECTATOR_MIRROR)
    {
      let autoUpdate = this.el.sceneEl.object3D.autoUpdate
      let gl = this.gl
      gl.bindFramebuffer(gl.FRAMEBUFFER, null)
      let camera = this.el.sceneEl.camera
      this.el.sceneEl.object3D.autoUpdate = false
      this.el.sceneEl.renderer.render(this.fakeNotSceneProxy, camera);
      this.el.sceneEl.object3D.autoUpdate = autoUpdate
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.el.sceneEl.renderer.xr.getSession().renderState.baseLayer.framebuffer)

    }
    if (this.data.state === SPECTATOR_CAMERA)
    {
      let autoUpdate = this.el.sceneEl.object3D.autoUpdate
      let gl = this.gl
      gl.bindFramebuffer(gl.FRAMEBUFFER, null)

      let renderer = this.el.sceneEl.renderer

      let camera
      if (this.data.state === SPECTATOR_MIRROR)
      {
        camera = this.el.sceneEl.camera
      }
      else
      {
        camera = this.data.camera.isCamera ? this.data.camera : this.data.camera.getObject3D('camera')
      }

      // camera.viewport = camera.viewport || new THREE.Vector4()
      let originalCameras = renderer.xr.getCamera(camera).cameras
      if (originalCameras.length === 0) return;

      // camera.near = this.el.sceneEl.camera.near
      camera.far = this.el.sceneEl.camera.far
      // camera.aspect = this.el.sceneEl.canvas.width / this.el.sceneEl.canvas.height
      camera.updateProjectionMatrix()

      let worldMat = this.pool('worldMat', THREE.Matrix4)
      worldMat.copy(camera.matrixWorld)

      let projMat = this.pool('projMat', THREE.Matrix4)
      projMat.copy(camera.projectionMatrix)

      // Hack into the THREE rendering loop to reset the camera, otherwise it
      // tracks head rotation
      let getCamera = renderer.xr.getCamera;
      renderer.xr.getCamera = () => {
        let cameraVR = getCamera(camera)
        cameraVR.cameras = [cameraVR.cameras[0]]

        cameraVR.matrix.identity()
        cameraVR.matrixWorld.copy(worldMat)
        cameraVR.matrixWorldInverse.copy(worldMat).invert()
        cameraVR.cameras[0].matrixWorld.copy(worldMat)
        cameraVR.cameras[0].matrixWorldInverse.copy(worldMat).invert()
        cameraVR.cameras[0].layers.enable(CAMERA_LAYERS.SPECTATOR)
        cameraVR.cameras[0].layers.disable(CAMERA_LAYERS.LEFT_EYE)

        cameraVR.cameras[0].projectionMatrix.copy(projMat)

        cameraVR.cameras[0].viewport.z = this.el.sceneEl.canvas.width
        cameraVR.cameras[0].viewport.w = this.el.sceneEl.canvas.height
        gl.viewport(0, 0, cameraVR.cameras[0].viewport.z / 1, cameraVR.cameras[0].viewport.w / 1)
        window.lastViewport = cameraVR.cameras[0].viewport

        cameraVR.layers.enable(CAMERA_LAYERS.SPECTATOR)
        return cameraVR
      };

      this.el.sceneEl.object3D.autoUpdate = false
      this.el.sceneEl.renderer.render(this.fakeNotSceneProxy, camera);
      this.el.sceneEl.object3D.autoUpdate = autoUpdate

      originalCameras[0].layers.disable(CAMERA_LAYERS.SPECTATOR)
      originalCameras[0].layers.enable(CAMERA_LAYERS.LEFT_EYE)
      renderer.xr.getCamera = getCamera
      renderer.xr.getCamera(camera).cameras = originalCameras

      gl.bindFramebuffer(gl.FRAMEBUFFER, xrSession.renderState.baseLayer.framebuffer)
    }
  }
})
