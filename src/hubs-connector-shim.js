import {Pool} from './pool.js'
import {Util} from './util.js'
const BSON = require('bson')

AFRAME.registerSystem('hubs-connector', {
  schema: {
    enabled: {default: true},
    host: {default: "http://localhost:3000"},
  },
  init() {
    let params = new URLSearchParams(document.location.search)
    let networked = params.get("hubs")
    console.log("Checking networked", networked, params)
    if (!networked) this.data.enabled = false

    Pool.init(this)
    this.tick = AFRAME.utils.throttleTick(this.tick, 10, this)

    this.readyForUpdate = true

    this.updateEmitData = {
      leftHand: {
        // position: new THREE.Vector3(),
        // rotation: {x: 0, y: 0, z: 0},
        matrix: new THREE.Matrix4(),
      },
      rightHand: {
        // position: new THREE.Vector3,
        // rotation: {x: 0, y: 0, z: 0},
        matrix: new THREE.Matrix4(),
      },
      head: {
        // position: new THREE.Vector3,
        // rotation: {x: 0, y: 0, z: 0},
        matrix: new THREE.Matrix4(),
      },
      canvas: {
        matrix: null,
        width: null,
        height: null
      },
      tool: {matrix: null},
    }

    this.poserEl = document.createElement('a-entity')
    this.el.append(this.poserEl)
    this.poser = this.poserEl.object3D

    Util.whenLoaded(this.el, async () => {
      this.rightHandEl = document.querySelector('#right-hand')
      this.leftHandEl = document.querySelector('#left-hand')

      if (networked) this.socket = await this.connectSocket();
    })
  },
  tick() {
    if (!this.data.enabled) return
    if (!this.readyForUpdate) return
    // this.readyForUpdate = false

    let socket = this.socket

    if (!socket) return;
    if (!socket.connected) return;

    let canvasLocation = this.pool('canvasLocation', THREE.Vector3)
    // Compositor.el.object3D.getWorldPosition(canvasLocation)
    Compositor.el.object3D.updateMatrixWorld()
    this.updateEmitData.canvas.matrix = Compositor.el.object3D.matrix
    this.updateEmitData.canvas.width = Compositor.el.getAttribute('geometry').width
    this.updateEmitData.canvas.height = Compositor.el.getAttribute('geometry').height

    let lastGrabbed = this.el.sceneEl.systems['pencil-tool'].lastGrabbed;

    if (lastGrabbed && lastGrabbed.el.is('grabbed'))
    {
      this.updateEmitData.tool.matrix = lastGrabbed.el.object3D.matrixWorld.elements
    }
    else
    {
      this.updateEmitData.tool.matrix = null
    }

    this.updateObj(this.leftHandEl, this.updateEmitData.leftHand)
    this.updateObj(this.rightHandEl, this.updateEmitData.rightHand)
    this.updateObj(Util.cameraObject3D(), this.updateEmitData.head)

    // if (this.el.sceneEl.is('vr-mode'))
    // {
    //   Util.cameraObject3D().el
    // }

    socket.emit('update', this.updateEmitData, (response) => {
      this.readyForUpdate = true
    })
  },
  updateObj(el, data) {
    if (!(el instanceof THREE.Object3D)) {
      el = el.object3D
    }
    Util.positionObject3DAtTarget(this.poser, el)
    data.matrix.copy(this.poser.matrixWorld)
    // Util.applyMatrix(el.matrixWorld, this.poser)
    // data.position.copy(this.poser.position)
    // data.rotation.x = this.poser.rotation.x * 180 / Math.PI
    // data.rotation.y = this.poser.rotation.y * 180 / Math.PI
    // data.rotation.z = this.poser.rotation.z * 180 / Math.PI

  },
  async connectSocket() {
    if (this._socket) return await this._socket

    this._socket = new Promise((resolve, err) => {
      let script = document.createElement('script')
      script.onerror = err;
      script.onload = () => resolve(script);
      script.async = false;
      document.head.appendChild(script)
      script.src = this.data.host + "/socket.io/socket.io.js"
    }).then((script) => {
      return io(this.data.host)
    })

    let s = await this._socket
    s.on('scene', (scene) => {
      return; // Don't Load Scene Now

      let loader = new THREE.GLTFLoader()
      loader.load(scene, (gltf) => {
        let entity = document.createElement('a-entity')
        entity.setObject3D("mesh", gltf.scene || gltf.scenes[0])
        document.querySelector('#world-root').append(entity)
      }, () => {}, (e) => {
        console.error(e)
      })
    })

    s.on('hubdate', (data) => {
      let tool = data.tool;
      if (!tool) return;
      if (!this.el.sceneEl.systems['pencil-tool'].lastGrabbed) return;

      let pencil = this.el.sceneEl.systems['pencil-tool'].lastGrabbed.el.object3D;
      pencil.matrix.fromArray(tool)
      Util.applyMatrix(pencil.matrix, pencil)
    })

    return await this._socket
  },
  presentationMode() {
    document.body.append(Compositor.component.preOverlayCanvas)
    Compositor.component.preOverlayCanvas.style = 'position: absolute; top: 0; left: 0; z-index: 100000; width: 100%; height: 100%'
  }
})
