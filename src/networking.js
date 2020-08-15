import {Pool} from './pool.js'
import shortid from 'shortid'

AFRAME.registerSystem('networking', {
  schema: {
    enabled: {default: true},
    host: {default: "http://localhost:3000"},
    frameRate: {default: 15},
  },
  init() {
    let params = new URLSearchParams(document.location.search)
    let networked = params.get("networked")
    console.log("Checking networked", networked, params)
    // if (!networked) this.data.enabled = false

    Pool.init(this)
    this.tick = AFRAME.utils.throttleTick(this.tick, Math.round(1000 / this.data.frameRate), this)

    this.startupPeer()

    let emptyCanvas = document.createElement('canvas')
    emptyCanvas.width = 5
    emptyCanvas.height = 5
    document.body.append(emptyCanvas)
    this.emptyCanvas = emptyCanvas
  },
  async startupPeer() {
    let peerPackage = await import('peerjs');
    this.peerjs = peerPackage.peerjs
    window.PeerJS = this.peerjs
  },

  presentationMode() {
    document.body.append(Compositor.component.preOverlayCanvas)
    Compositor.component.preOverlayCanvas.style = 'position: absolute; top: 0; left: 0; z-index: 100000; width: 100%; height: 100%'
  },

  async callFor(id, onvideo) {
    console.log("Calling for", id)
    let peer = new this.peerjs.Peer(`vartiste-callfor-${shortid.generate()}-${id}`)

    await new Promise((r,e) => peer.on('open', r, {once: true}))

    let pcall = peer.call(`vartiste-answerTo-${id}`, this.emptyCanvas.captureStream(this.data.frameRate))

    pcall.on('stream', async (remoteStream) => {
      console.log("Got remote stream", id, remoteStream)
        let video = document.createElement('video')
        video.autoplay = true
        video.srcObject = remoteStream

        // video.play()

        video.classList.add('rtc-stream')

        // video.classList.add('debug')
        // document.body.append(video)

        console.log("Added video")

        // Using callback to add handling for error / recovery
        onvideo(video)
    })
    // pcall.on('close', () =>{})
    pcall.on('error', (e) => {
      console.warn("Could not call to", id, e )
    })

    return pcall
  },

  answerTo(id, canvas, {oncall = function() {}} = {}) {
    var stream = canvas.captureStream(this.data.frameRate)

    // let v = document.createElement('video')
    // v.srcObject = stream
    // v.play()
    // v.classList.add('debug')
    // document.body.append(v)

    let peer = new this.peerjs.Peer(`vartiste-answerTo-${id}`)
    console.log('answer peer', peer)
    peer.on('call', async (call) => {
      console.info("Got call")

      console.debug("Answering call", stream)

      call.answer(stream); // Answer the call with an A/V stream.
      // oncall()
    })

    return peer
  },

  tick(t, dt) {
    for (let node of Compositor.component.allNodes)
    {
      if (node.broadcasting)
      {
        node.updateCanvas(Compositor.component.currentFrame)
      }

      if (node.receivingBroadcast)
      {
        node.touch()
      }
    }
  }
})
