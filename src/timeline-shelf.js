import {CanvasRecorder} from './canvas-recorder.js'
import {Util} from './util.js'
import Gif from 'gif.js'
import {Pool} from './pool.js'
import {Undo} from './undo.js'

Util.registerComponentSystem('timeline-system', {
  schema: {
    endFrameNumber: {default: 10},
  },
  exportFrames() {
    let numberOfFrames = this.data.endFrameNumber
    let compositor = Compositor.component
    for (let frame = 0; frame < numberOfFrames; frame++)
    {
      compositor.jumpToFrame(frame)
      compositor.quickDraw()
      this.el.sceneEl.systems['settings-system'].exportAction({suffix: `frame-${frame}`})
    }
  },
  async exportGif() {
    let numberOfFrames = this.data.endFrameNumber
    let compositor = Compositor.component
    let gif = new Gif({
      workers: 2,
      quality: 10,
      workerScript: require('file-loader!gif.js/dist/gif.worker.js')
    })

    for (let frame = 0; frame < numberOfFrames; frame++)
    {
      compositor.jumpToFrame(frame)
      compositor.quickDraw()
      gif.addFrame(Compositor.component.preOverlayCanvas, {copy: true, delay: 1000 / Compositor.component.data.frameRate})
    }

    let url = await new Promise((r, e) => {
      gif.on('finished', function(blob) {
        r(URL.createObjectURL(blob))
      });

      try { gif.render(); } catch (ex)  { e(ex) }
    })

    this.el.sceneEl.systems['settings-system'].download(url, {extension: 'gif'}, "Gif animation")
  },
  async recordFrames() {
    let numberOfFrames = this.data.endFrameNumber
    let compositor = Compositor.component

    compositor.isPlayingAnimation = false
    compositor.jumpToFrame(0)

    let settings = this.el.sceneEl.systems['settings-system']

    if (settings.compositeRecorder)
    {
      throw new Error("Already recording!!")
    }

    await new Promise((resolve, error) => {
      let onFrameChanged = e => {
        if (e.detail.frame >= numberOfFrames)
        {
          compositor.el.removeEventListener('framechanged', onFrameChanged)
          resolve()
        }
      }
      compositor.el.addEventListener('framechanged', onFrameChanged)

      settings.recordAction()
      compositor.playPauseAnimation()
    })

    settings.recordAction()


    // let compositeRecorder = new CanvasRecorder({canvas: compositor.compositeCanvas, frameRate: 25})
    // compositor.data.drawOverlay = false
    // compositeRecorder.recordFrames(numberOfFrames)
    // await compositeRecorder.stop()
    // this.el.sceneEl.systems['settings-system'].download(compositeRecorder.createURL(), `${this.el.sceneEl.systems['settings-system'].projectName}-${this.el.sceneEl.systems['settings-system'].formatFileDate()}.webm`, "Video Recording")
  },
})

AFRAME.registerComponent('timeline-shelf', {
  init() {
    this.el.addEventListener('click', (e) => {
      console.log("Timeline click", e, e.target, e.target.getAttribute('click-action'))
      let compositor = document.getElementById('canvas-view').components.compositor
      let rawAction = e.target.getAttribute("click-action");
      let action = rawAction + "Action"
      if (action in this)
      {
        this[action](e)
      }
      else if (rawAction in compositor)
      {
        compositor[rawAction]()
      }
    })

    let compositor = document.getElementById('canvas-view');

    this.el.querySelector('.fps').addEventListener('editfinished', e=>{
      compositor.setAttribute('compositor', {frameRate: e.detail.value})
    })

    compositor.addEventListener('componentchanged', e => {
      if (e.detail.name === 'compositor')
      {
        this.el.querySelector('.fps').setAttribute('text', {value: compositor.getAttribute('compositor').frameRate})
      }
    })

    this.updateFrame = this.updateFrame.bind(this)
    compositor.addEventListener('framechanged', this.updateFrame)
    compositor.addEventListener('layerupdated', this.updateFrame)

    if (compositor.hasLoaded)
    {
      this.updateFrame()
    }
    else
    {
      compositor.addEventListener('componentinitialized', this.updateFrame)
    }
  },
  updateFrame()
  {
    let {activeLayer, currentFrame} = document.getElementById('canvas-view').components.compositor
    this.el.querySelector('.frame-counter').setAttribute('text', {value: `Frame ${activeLayer.frameIdx(currentFrame) + 1} / ${activeLayer.frames.length} (${currentFrame})`})
  },
  firstFrameAction()
  {
    document.getElementById('canvas-view').components.compositor.jumpToFrame(0)
  },
  recordAction()
  {
    this.el.sceneEl.systems['settings-system'].recordAction()
  }
})
