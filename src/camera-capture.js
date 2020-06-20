import {Pool} from './pool.js'
import {Util} from './util.js'
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
  captureToCanvas(camera, canvas) {
    if (!canvas) canvas = this.getTempCanvas()
    this.el.sceneEl.renderer.render(this.el.sceneEl.object3D, camera);

    canvas.getContext('2d').drawImage(this.el.sceneEl.canvas, 0, 0, canvas.width, canvas.height)
    return canvas
  }
})

AFRAME.registerComponent('camera-tool', {
  events: {
    click: function(e) {
      this.takePicture()
    },
  },
  init() {
    Pool.init(this)
    this.el.classList.add('grab-root')


    const depth = 0.1
    const cameraWidth = 0.3
    Util.whenLoaded(Compositor.el, () => {
      let {width, height} = Compositor.el.getAttribute('geometry')
      Compositor.el.object3D.updateMatrixWorld()
      let scale = this.pool('scale', THREE.Vector3)
      scale.setFromMatrixScale(Compositor.el.object3D.matrixWorld)
      width = width * scale.x
      height = height * scale.y

      let camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 10)
      this.el.object3D.add(camera)

      this.camera = camera

      var helper = new THREE.CameraHelper( camera );
      this.helper = helper
      this.el.sceneEl.object3D.add( helper );

      let body = document.createElement('a-box')
      body.setAttribute('depth', depth)
      body.setAttribute('width', cameraWidth)
      body.setAttribute('height', height / width * cameraWidth)
      body.setAttribute('propogate-grab', "")
      body.setAttribute('position', `0 0 ${-depth / 2 - 0.001}`)
      body.classList.add('clickable')
      this.el.append(body)
    })
  },
  takePicture() {
    this.helper.visible = false
    this.el.sceneEl.systems['camera-capture'].captureToCanvas(this.camera, Compositor.component.activeLayer.canvas)
    this.helper.visible = true
  }
})
