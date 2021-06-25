import {addImageReferenceViewer} from './file-upload.js'
import {Util} from './util.js'
import {CAMERA_LAYERS} from './layer-modes.js'

AFRAME.registerComponent('stop-media-on-removed', {
  remove() {
    try {
      this.mediaStream.getVideoTracks()[0].stop()
    }
    catch(e)
    {
      console.log("Couldn't stop video", e)
    }
  }
})

AFRAME.registerSystem('user-media', {
  async showDesktop() {
    let mediaStream
    try {
      mediaStream = await navigator.mediaDevices.getDisplayMedia()
    }
    catch (e)
    {
      console.error("Could not acquire display media", e)
      return
    }

    return await this.showMedia(mediaStream)
  },
  async showCamera() {
    let mediaStream
    try {
      mediaStream = await navigator.mediaDevices.getUserMedia({video: true})
    }
    catch (e)
    {
      console.error("Could not acquire user media", e)
      return
    }

    let viewer = await this.showMedia(mediaStream)
    Util.whenLoaded(viewer, () => {
      let sideBySideButton = viewer.components.frame.addButton('#asset-transition')
      sideBySideButton.setAttribute('tooltip', 'Side-by-side display')

      sideBySideButton.addEventListener('click', (e) => {
        viewer.setAttribute('side-by-side-display', '')
      })
    })

    return viewer
  },
  async showMedia(mediaStream)
  {

    let video = document.createElement('video')
    video.srcObject = mediaStream

    await video.play()
    window.lastVideo = video
    video.width = video.videoWidth
    video.height = video.videoHeight
    console.log(video.width, video.height, video)

    let viewer = addImageReferenceViewer(video)
    viewer.setAttribute('stop-media-on-removed', "")
    Util.whenLoaded(viewer, () => {
      viewer.components['stop-media-on-removed'].mediaStream = mediaStream
    })
    return viewer
  }
})

AFRAME.registerComponent('side-by-side-display', {
  dependencies: ['geometry'],
  schema: {
    ipd: {default: 0.0},
    controls: {default: true},
  },
  init() {
    let bg = this.el.getObject3D('mesh')

    let left = bg.clone()
    bg.parent.add(left)
    bg.material = new THREE.MeshBasicMaterial({color: '#000'})

    left.scale.x *= 0.5
    for (let i = 0; i < left.geometry.attributes.uv.count; ++i)
    {
      left.geometry.attributes.uv.array[i * 2] *= 0.5
    }
    left.geometry.attributes.uv.needsUpdate = true
    left.layers.disable(CAMERA_LAYERS.DEFAULT)
    left.layers.enable(CAMERA_LAYERS.LEFT_EYE)
    left.position.z += 0.001

    let right = left.clone()
    right.geometry = right.geometry.clone();
    for (let i = 0; i < left.geometry.attributes.uv.count; ++i)
    {
      right.geometry.attributes.uv.array[i * 2] += 0.5
    }
    right.geometry.attributes.uv.needsUpdate = true
    right.position.z += 0.001
    left.parent.add(right)
    right.layers.disable(CAMERA_LAYERS.DEFAULT)
    left.layers.disable(CAMERA_LAYERS.LEFT_EYE)
    left.layers.enable(CAMERA_LAYERS.RIGHT_EYE)

    this.left = left;
    this.right = right;

    if (this.data.controls) {
      let ipdLever = document.createElement('a-entity')
      this.el.append(ipdLever)
      ipdLever.setAttribute('lever', {axis: 'y', valueRange: '-0.5 0.5', target: this.el, component: 'side-by-side-display', property: 'ipd'})
      ipdLever.setAttribute('position', `0 -${this.el.getAttribute('geometry').height / 2 + 0.1} 0`)
      ipdLever.setAttribute('scale', '0.5 0.5 0.5')
    }
  },
  update(oldData) {
    if (!this.right) return;

    this.right.position.x = this.data.ipd;
  }
})
