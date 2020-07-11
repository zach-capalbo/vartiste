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
    fov: {default: 45.0}
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

    const depth = 0.1
    const cameraWidth = 0.3
    Util.whenLoaded(Compositor.el, () => {
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
    Undo.pushCanvas(Compositor.component.activeLayer.canvas)
    this.el.sceneEl.emit("startsnap", {source: this.el})
    this.helper.visible = false
    this.el.sceneEl.systems['camera-capture'].captureToCanvas(this.camera, Compositor.component.activeLayer.canvas)
    Compositor.component.activeLayer.touch()
    this.helper.visible = true
    this.el.sceneEl.emit("endsnap", {source: this.el})
  },
  activate() {
    var helper = new THREE.CameraHelper( this.camera );
    this.helper = helper
    this.el.sceneEl.object3D.add( helper );
  }
})


AFRAME.registerComponent('spray-can-tool', {
  schema: {
    orthographic: {default: false},
    fov: {default: 5.0}
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

    const depth = 0.1
    const cameraWidth = 0.3
    Util.whenLoaded(Compositor.el, () => {
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
    Undo.pushCanvas(Compositor.component.activeLayer.canvas)
    this.el.sceneEl.emit("startsnap", {source: this.el})
    this.helper.visible = false
    let processor = new CanvasShaderProcessor({fx: 'uv-index'})
    processor.setInputCanvas(Compositor.component.compositeCanvas)
    processor.update()
    Compositor.material.map.image = processor.canvas
    Compositor.material.map.needsUpdate = true

    let capturedImage = this.el.sceneEl.systems['camera-capture'].captureToCanvas(this.camera)

    // TODO: Shaderize this
    let capturedData = capturedImage.getContext("2d").getImageData(0, 0, capturedImage.width, capturedImage.height)
    let targetCanvas = Compositor.component.activeLayer.canvas
    let targetData = targetCanvas.getContext("2d").getImageData(0, 0, targetCanvas.width, targetCanvas.height)
    for (let y = 0; y < capturedImage.height; y++)
    {
      for (let x = 0; x < capturedImage.width; x++)
      {
        let ulow = capturedData.data[((y * capturedImage.width) + x) * 4 + 0]
        let uhigh = capturedData.data[((y * capturedImage.width) + x) * 4 + 1]
        let vlow = capturedData.data[((y * capturedImage.width) + x) * 4 + 2]
        let vhigh = capturedData.data[((y * capturedImage.width) + x) * 4 + 3]

        let u = (ulow + (uhigh << 8)) / 65536
        let v = (vlow + (vhigh << 8)) / 65536

        let xx = Math.round(u * targetCanvas.width)
        let yy = Math.round(v * targetCanvas.height)
        if ((x + y * capturedData.width) % 1000 == 0)
        {
          console.log("UV", u, v, xx, yy, ulow, uhigh, vlow, vhigh)
        }
        targetData.data[[((yy * targetCanvas.width) + xx) * 4 + 0]] = 0
        targetData.data[[((yy * targetCanvas.width) + xx) * 4 + 1]] = 100
        targetData.data[[((yy * targetCanvas.width) + xx) * 4 + 2]] = 0
        targetData.data[[((yy * targetCanvas.width) + xx) * 4 + 3]] = 255
      }
    }
    targetCanvas.getContext("2d").putImageData(targetData, 0, 0)
    Compositor.component.activeLayer.touch()

    this.helper.visible = true
    this.el.sceneEl.emit("endsnap", {source: this.el})
  },
  activate() {
    var helper = new THREE.CameraHelper( this.camera );
    this.helper = helper
    this.el.sceneEl.object3D.add( helper );
  }
})
