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
    this.tick = AFRAME.utils.throttleTick(this.tick, 10, this)

    this.readyForUpdate = true

    Util.whenLoaded(this.el, async () => {
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

    this.el.sceneEl.systems['avatar-pose-export-provider'].needsUpdate = true
    socket.emit('update', this.el.sceneEl.systems['avatar-pose-export-provider'].updatePose(), (response) => {
      this.readyForUpdate = true
    })
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
