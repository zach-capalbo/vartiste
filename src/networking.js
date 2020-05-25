import {Pool} from './pool.js'

AFRAME.registerSystem('networking', {
  schema: {
    enabled: {default: true},
    host: {default: "http://localhost:3000"}
  },
  init() {
    let params = new URLSearchParams(document.location.search)
    let networked = params.get("networked")
    console.log("Checking networked", networked, params)
    if (!networked) this.data.enabled = false

    Pool.init(this)
    this.tick = AFRAME.utils.throttleTick(this.tick, 500, this)
  },
  async tick() {
    if (!this.data.enabled) return

    let socket = await this.socket()

    let canvasLocation = this.pool('canvasLocation', THREE.Vector3)
    // Compositor.el.object3D.getWorldPosition(canvasLocation)
    Compositor.el.object3D.updateMatrixWorld()


    socket.emit('update', {
      leftHand: {
        position: document.querySelector('#left-hand').object3D.position,
        rotation: document.querySelector('#left-hand').getAttribute('rotation'),
      },
      rightHand: {
        position: document.querySelector('#right-hand').object3D.position,
        rotation: document.querySelector('#right-hand').getAttribute('rotation'),
      },
      head: {
        rotation: document.querySelector('#camera').getAttribute('rotation'),
        position: document.querySelector('#camera').getAttribute('position')
      },
      canvas: {
        matrix: Compositor.el.object3D.matrixWorld,
        width: Compositor.el.getAttribute('geometry').width,
        height: Compositor.el.getAttribute('geometry').height
      }
    })
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
