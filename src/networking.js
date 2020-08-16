import {Pool} from './pool.js'
import {NetworkOutputNode, NetworkInputNode} from './layer.js'
import shortid from 'shortid'

AFRAME.registerSystem('networking', {
  schema: {
    enabled: {default: true},
    host: {default: "http://localhost:3000"},
    frameRate: {default: 15},
    connectAttemptDowntime: {default: 30000},
  },
  init() {
    let params = new URLSearchParams(document.location.search)
    console.log("Checking networked", params)

    let broadcastTo = params.get("broadcastTo")


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

  createSymmetricLink() {
    let parts = []
    for (let node of Compositor.component.allNodes)
    {
      if (node instanceof NetworkOutputNode)
      {
        parts.push(`receiveFrom=${node.name}`)
      }
      else if (node instanceof NetworkInputNode)
      {
        parts.push(`broadcastTo=${node.name}`)
      }
    }

    let link = `${location.origin}/?${parts.join("&")}`

    console.log('Link', link)
    this.el.sceneEl.systems['settings-system'].copyToClipboard(link, "Connection link")
  },

  async callFor(id, {onvideo, onalpha, onpeer, onerror}) {
    console.log("Calling for", id)
    let peer = new this.peerjs.Peer(`vartiste-callfor-${shortid.generate()}-${id}-x`)

    await new Promise((r,e) => {
      peer.on('open', r, {once: true})
      peer.on('error', e, {once: true})
    })

    peer.on('error', (e) => {
      console.log("Failed to call", e)
      onerror(e)
    })

    let pcall = peer.call(`vartiste-answerTo-${id}-x`, this.emptyCanvas.captureStream(this.data.frameRate), {metadata: {type: 'color'}})

    pcall.on('stream', async (remoteStream) => {
      console.log("Got remote stream", id, remoteStream)
      let video = document.createElement('video')
      video.autoplay = true
      video.srcObject = remoteStream
      video.classList.add('rtc-stream')

      console.log("Added video")

      // Using callback to add handling for error / recovery
      onvideo(video)
    })

    pcall.on('error', (e) => {
      console.warn("Could not call to", id, e )
    })

    pcall = peer.call(`vartiste-answerTo-${id}-x`, this.emptyCanvas.captureStream(this.data.frameRate), {metadata: {type: 'alpha'}})

    pcall.on('stream', async (remoteStream) => {
      console.log("Got remote alpha stream", id, remoteStream)
      let video = document.createElement('video')
      video.autoplay = true
      video.srcObject = remoteStream
      video.classList.add('rtc-stream')

      console.log("Added alpha")

      // Using callback to add handling for error / recovery
      onalpha(video)
    })

    // pcall.on('close', () =>{})
    pcall.on('error', (e) => {
      console.warn("Could not call to", id, e )
    })

    // let dataConnection = peer.connect(`vartiste-answerTo-${id}`)
    // dataConnection.on('data', (data) => {
    //
    // })

    onpeer(peer)
  },

  answerTo(id, canvas, alphaCanvas) {
    var stream = canvas.captureStream(this.data.frameRate)
    var alphaStream

    if (alphaCanvas)
    {
      alphaStream = alphaCanvas.captureStream(this.data.frameRate)
    }

    let peer = new this.peerjs.Peer(`vartiste-answerTo-${id}-x`)
    console.log('answer peer', peer)
    peer.on('call', async (call) => {
      console.info("Got call", call.metadata)

      console.debug("Answering call", stream)

      if (call.metadata.type === 'alpha')
      {
        call.answer(alphaStream)
      }
      else
      {
        call.answer(stream);
      }
    })

    return peer
  },

  tick(t, dt) {
    for (let node of Compositor.component.allNodes)
    {
      if (node.needsConnection)
      {
        if (t - (node.lastAttempt || 0) >= this.data.connectAttemptDowntime)
        {
          node.lastAttempt = t
          node.connectNetwork()
        }
      }
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
