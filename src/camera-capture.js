import {Pool} from './pool.js'
import {Util} from './util.js'
import {Undo} from './undo.js'
import CubemapToEquirectangular from './framework/CubemapToEquirectangular.js'

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
  schema: {
    orthographic: {default: false},
    fov: {default: 45.0},
    autoCamera: {default: true}
  },
  events: {
    click: function(e) {
      this.takePicture()
    },
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
        camera = new THREE.PerspectiveCamera(this.data.fov, width / height, 0.1, 10)
      }
      this.el.object3D.add(camera)

      this.camera = camera

      let body = document.createElement('a-box')
      body.setAttribute('depth', depth)
      body.setAttribute('width', cameraWidth)
      body.setAttribute('height', height / width * cameraWidth)
      body.setAttribute('propogate-grab', "")
      body.setAttribute('position', `0 0 ${-depth / 2 - 0.001}`)
      body.setAttribute('material', 'src:#asset-shelf')
      body.classList.add('clickable')
      this.el.append(body)

      Compositor.el.addEventListener('resized', (e) => {
        let {width, height} = e.detail
      })
    })

    let activate = (e) => {
      if (e.detail === 'grabbed') {
        this.activate()
        this.el.removeEventListener('stateadded', activate)
      }
    };
    this.el.addEventListener('stateadded', activate)
  },
  takePicture() {
    console.log("Taking picture")
    let targetCanvas = Compositor.component.activeLayer.frame(Compositor.component.currentFrame)
    Undo.pushCanvas(targetCanvas)
    this.el.sceneEl.emit("startsnap", {source: this.el})
    this.helper.visible = false
    this.el.sceneEl.systems['camera-capture'].captureToCanvas(this.camera, targetCanvas)
    Compositor.component.activeLayer.touch()
    this.helper.visible = true
    this.el.sceneEl.emit("endsnap", {source: this.el})
  },
  activate() {
    var helper = new THREE.CameraHelper( this.camera );
    this.helper = helper
    this.el.sceneEl.object3D.add( helper );

    let wm = new THREE.Matrix4
    this.el.object3D.updateMatrixWorld()
    wm.copy(this.el.object3D.matrixWorld)
    this.el.object3D.parent.remove(this.el.object3D)
    document.querySelector('#world-root').object3D.add(this.el.object3D)
    Util.applyMatrix(wm, this.el.object3D)
  }
})


AFRAME.registerComponent('spray-can-tool', {
  dependencies: ['camera-tool'],
  init() {
    Pool.init(this)
    this.el.setAttribute('camera-tool', {autoCamera: false})
    this.takePicture = this.takePicture.bind(this.el.components['camera-tool'])
    this.el.components['camera-tool'].takePicture = this.takePicture;

    (function(self) {
      this.cameraCanvas = document.createElement('canvas')
      this.cameraCanvas.width = 64
      this.cameraCanvas.height = 64
      this.targetCanvas = document.createElement('canvas')
      this.targetCanvas.width = 1024
      this.targetCanvas.height = 512

      let camera = new THREE.PerspectiveCamera(5, 1, 0.1, 1)
      camera.layers.mask = 2
      this.el.object3D.add(camera)
      this.camera = camera

      let body = document.createElement('a-cylinder')
      body.setAttribute('radius', 0.1)
      body.setAttribute('height', 0.3)
      body.setAttribute('propogate-grab', "")
      body.setAttribute('segments-radial', 10)
      body.setAttribute('segments-height', 1)
      body.setAttribute('position', `0 -.17 ${-0.1 / 2 - 0.001}`)
      body.setAttribute('material', 'src:#asset-shelf; metalness: 0.7')
      body.classList.add('clickable')
      this.el.append(body)
      this.captureToCanvas = self.captureToCanvas

      this.el.sceneEl.addEventListener('brushscalechanged', () => {
        this.savedBrush = undefined
      })
    }).call(this.el.components['camera-tool'], this)

    this.tick = AFRAME.utils.throttleTick(this.tick, 10, this)
  },
  captureToCanvas(camera, canvas) {
    let renderer = this.el.sceneEl.renderer
    let wasXREnabled = renderer.xr.enabled
    renderer.xr.enabled = false

    let oldTarget = renderer.getRenderTarget()

    let {width, height} = canvas

    if (!this.newTarget) {
      this.newTarget = new THREE.WebGLRenderTarget(width, height)
    }
    let newTarget = this.newTarget

    renderer.setRenderTarget(newTarget)

    renderer.render(this.el.sceneEl.object3D, camera);

    let data = this.buffer

    if (!data)
    {
      data = canvas.getContext("2d").getImageData(0, 0, width, height)
      this.buffer = data
    }

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

    let brush = this.el.sceneEl.systems['paint-system'].brush
    let color = brush.color3

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
          o.layers.mask = 3
        }
      })

    // this.cameraCanvas.clearRect(0, 0, this.cameraCanvas.width, this.cameraCanvas.height)
    let capturedImage = this.cameraCanvas

    // let pictureTime = Date.now() - startTime

    // TODO: Shaderize this
    let capturedData = this.captureToCanvas(this.camera, this.cameraCanvas)
    let targetCanvas = this.targetCanvas
    let finalDestinationCanvas = Compositor.component.activeLayer.frame(Compositor.component.currentFrame)

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

    if (this.savedBrush != brush)
    {
      this.savedBrush = brush
      this.brushData = brush.overlayCanvas.getContext("2d").getImageData(0, 0, brush.width, brush.height)
    }

    let brushData = this.brushData

    // let imageDataTime = Date.now() - startTime - pictureTime
    var x,y,r,g,b,a,bx,by,u,v,xx,yy;

    if (!this.touchedPixels)
    {
      this.touchedPixels = {}
    }

    let touchedPixels = this.touchedPixels

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

        u = (((b & 0xF0) >> 4) * 256 + r) / 4096
        v = ((b & 0x0F) * 256 + g) / 4096

        xx = Math.round(u * targetCanvas.width)
        yy = Math.round(v * targetCanvas.height)

        touchedPixels[((yy * targetCanvas.width) + xx) * 4] = true

        targetData.data[((yy * targetCanvas.width) + xx) * 4 + 0] = brush.color3.r * 255
        targetData.data[((yy * targetCanvas.width) + xx) * 4 + 1] = brush.color3.g * 255
        targetData.data[((yy * targetCanvas.width) + xx) * 4 + 2] = brush.color3.b * 255
        targetData.data[((yy * targetCanvas.width) + xx) * 4 + 3] = brushData.data[((by * brush.overlayCanvas.width) + bx) * 4 + 3] * a / 255.0
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

    Compositor.meshRoot.traverse(o =>
      {
        if (o.type === 'Mesh' || o.type === 'SkinnedMesh')
        {
          o.material = oldMaterial
        }
      })

    this.helper.visible = true
    // this.el.sceneEl.emit("endsnap", {source: this.el})

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
