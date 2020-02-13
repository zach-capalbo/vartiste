class CanvasRecorder {
  constructor({canvas, frameRate}) {
    this.canvas = canvas
    this.stream = canvas.captureStream(frameRate)
    this.recordedChunks = []
    this.mediaRecorder = new MediaRecorder(this.stream, {
      mimeType: "video/webm; codecs=vp9"
      // mimeType: "video/webm;codecs=H264"
    })
    this.mediaRecorder.ondataavailable = (e) => this.handleDataAvailable(e)
  }
  recordFrames(numFrames, goToFrame)
  {
    for (let frame = 0; frame < numFrames; frame++)
    {
      goToFrame(frame)
      this.stream.requestFrame()
    }
  }
  async stop() {
    let stopPromise = new Promise((r,e) => {
      this.gotLastData = r
    })
    console.log("Calling stop")
    this.mediaRecorder.stop()
    console.log("awaiting stop")
    await stopPromise
  }
  handleDataAvailable(event) {
    if (event.data.size > 0) {
      console.log("Got Chunk", event.data.mimeType)
      this.recordedChunks.push(event.data);
      this.gotLastData()
    }
    else {
      console.log("No data")
      this.gotLastData()
    }
  }
  createURL() {
    console.log("Creating", this.recordedChunks)
    let blob =  new Blob(this.recordedChunks, {
      type: "video/webm"
    })

    return URL.createObjectURL(blob)
  }
}

export {CanvasRecorder}
