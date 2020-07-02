import {addImageReferenceViewer} from './file-upload.js'
import {Util} from './util.js'

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

    return await this.showMedia(mediaStream)
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
  }
})
