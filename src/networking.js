import {Pool} from './pool.js'
import {Util} from './util.js'
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
    Pool.init(this)
    this.tick = AFRAME.utils.throttleTick(this.tick, Math.round(1000 / this.data.frameRate), this)

    let emptyCanvas = document.createElement('canvas')
    emptyCanvas.width = 5
    emptyCanvas.height = 5
    document.body.append(emptyCanvas)
    this.emptyCanvas = emptyCanvas

    this.startupPeer()
    .then(() => {
      Util.whenLoaded(Compositor.el, () => {
        let params = new URLSearchParams(document.location.search)
        console.log("Checking networked", params)

        let switchToNodes = false

        for (let broadcastTo of params.getAll("broadcastTo"))
        {
          switchToNodes = true
          this.addBroadcastTo(broadcastTo)
        }

        for (let receiveFrom of params.getAll('receiveFrom'))
        {
          switchToNodes = true
          this.addReceiveFrom(receiveFrom)
        }

        if (switchToNodes)
        {
          Compositor.el.setAttribute('compositor', 'useNodes', true)
        }
      })
    })

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

    let link = `${location.origin}${location.pathname}?${parts.join("&")}`

    console.log('Link', link)
    this.el.sceneEl.systems['settings-system'].copyToClipboard(link, "Connection link")
  },

  addBroadcastTo(id) {
    let node = new NetworkOutputNode(Compositor.component)
    node.name = id
    node.shelfMatrix.fromArray([0.15805415874294995, 0, 0, 0, 0, 0.15805415874294995, 0, 0, 0, 0, 0.15805415874294995, 0, 0.6533299092054572, 0.009472981401967163, 0.31182788983072185, 1])
    node.shelfMatrix.setPosition((Compositor.component.allNodes.length - 2) * 0.65, 0, 0.3)
    node.connectDestination(Compositor.component.layers[1])
  },

  addReceiveFrom(id) {
    let node = new NetworkInputNode(Compositor.component)
    node.name = id
    node.shelfMatrix.fromArray([0.15805415874294995, 0, 0, 0, 0, 0.15805415874294995, 0, 0, 0, 0, 0.15805415874294995, 0, 0.6533299092054572, 0.009472981401967163, 0.31182788983072185, 1])
    node.shelfMatrix.setPosition((Compositor.component.allNodes.length - 2) * 0.65, 0, 0.3)
    let compositionNode = Compositor.component.allNodes[1]
    compositionNode.connectInput(node, {type: 'source', index: compositionNode.sources.length})
    // node.connectDestination(Compositor.component.layers[1])
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
