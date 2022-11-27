import { Util } from "./util"
import {ffmpeg} from './framework/ffmpeg.js'
import {base64ArrayBuffer} from './framework/base64ArrayBuffer.js'

class CanvasRecorder {
  constructor({canvas, frameRate = 0} = {}) {
    if (!canvas) canvas = Compositor.component.compositeCanvas
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
    // this.mediaRecorder.start()
    for (let frame = 0; frame < numFrames; frame++)
    {
      Compositor.component.jumpToFrame(frame)
      Compositor.component.quickDraw()
      this.stream.getVideoTracks()[0].requestFrame()
    }
  }
  captureFrame()
  {
    Compositor.component.quickDraw()
    this.stream.getVideoTracks()[0].requestFrame()
  }
  start() {
    this.mediaRecorder.start()
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

Util.registerComponentSystem('compositor-history-recorder', {
  schema: {
    recording: {default: false},
    throttle: {default: 300},
    maxFrames: {default: 2000},
  },
  init() {
    this.tick = AFRAME.utils.throttleTick(this.tick, this.data.throttle, this)
    this.hasStarted = false
  },
  update(oldData) {
    if (this.data.recording !== oldData.recording)
    {
      if (this.data.recording)
      {
        this.startRecording()
      }
      else if (oldData.recording)
      {
        this.stopRecording().then(() => this.download())
      }
    }
  },
  startRecording() {
    if (!ffmpeg.isLoaded())
    {
      ffmpeg.load().then(() => this.startRecording())
      return;
    }

    if (this.hasStarted) return;
    this.hasStarted = true;
    this.data.recording = true;
    this.lastFrameT = 0;
    this.frameIndex = 0;
  },
  async stopRecording() {
    if (this.isStopping) return;
    if (!this.hasStarted) return;
    this.isStopping = true;
    this.data.recording = false;
    this.hasStarted = false;
    this.isStopping = false;
  },
  async download() {
    const extension = "mp4"
    const args = ["-pix_fmt", "yuv420p"]
    await ffmpeg.run('-r', `${Compositor.component.data.frameRate}`, '-i', '%d.png', ...args, `output.${extension}`);
    let data = ffmpeg.FS('readFile', `output.${extension}`);

    this.el.sceneEl.systems['settings-system'].download("data:application/x-binary;base64," + base64ArrayBuffer(data), {extension}, "Canvas Recording")

  },
  async captureFrame() {
    ffmpeg.FS('writeFile', `${this.frameIndex++}`.padStart("0", 8) + ".png", await ffmpeg.fetchFile(Compositor.component.preOverlayCanvas.toDataURL()))
  },
  tick(t, dt)
  {
    if (!this.data.recording) return;
    if (!this.hasStarted) return;
    
    if (this.lastFrameT < Compositor.component.nonOverlayUpdateT)
    {
      console.log("Capturing frame", Compositor.component.nonOverlayUpdateT, this.lastFrameT)
      this.captureFrame()
      this.lastFrameT = t;

      if (this.data.maxFrames > 0 && this.frameIndex > this.data.maxFrames)
      {
        (async () => {
          await this.stopRecording()
          await this.download()
          this.startRecording()
        })();
      }
    }
  }
})
