import {Pool} from './pool.js'
import {Util} from './util.js'

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
    this.tick = AFRAME.utils.throttleTick(this.tick, 500, this)

    this.updateEmitData = {
      leftHand: {
        position: new THREE.Vector3(),
        rotation: null,
      },
      rightHand: {
        position: new THREE.Vector3,
        rotation: null,
      },
      head: {
        rotation: new THREE.Vector3,
        position: null
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

    Util.whenLoaded(this.el, () => {
      this.rightHandEl = document.querySelector('#right-hand')
      this.leftHandEl = document.querySelector('#right-hand')
    })
  },
  async tick() {
    if (!this.data.enabled) return

    let socket = await this.socket()

    let canvasLocation = this.pool('canvasLocation', THREE.Vector3)
    // Compositor.el.object3D.getWorldPosition(canvasLocation)
    Compositor.el.object3D.updateMatrixWorld()

    let tool;

    let lastGrabbed = this.el.sceneEl.systems['pencil-tool'].lastGrabbed;

    if (lastGrabbed && lastGrabbed.el.is('grabbed'))
    {
      tool = {
        matrix: lastGrabbed.el.object3D.matrixWorld.elements
      }
    }

    this.updateObj(this.leftHandEl, this.updateEmitData.leftHand)
    this.updateObj(this.rightHandEl, this.updateEmitData.rightHand)
    this.updateObj(Util.cameraObject3D().el, this.updateEmitData.head)

    socket.emit('update', this.updateEmitData)
  },
  updateObj(el, data) {
    Util.positionObject3DAtTarget(this.poser, el.object3D)
    data.position.copy(this.poser.position)
    data.rotation = this.poserEl.getAttribute('rotation')
  },
  async socket() {
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

    return await this._socket
  },
  presentationMode() {
    document.body.append(Compositor.component.preOverlayCanvas)
    Compositor.component.preOverlayCanvas.style = 'position: absolute; top: 0; left: 0; z-index: 100000; width: 100%; height: 100%'
  }
})
