import {CanvasRecorder} from './canvas-recorder.js'

function lcm(x,y) {
  return Math.abs((x * y) / gcd(x,y))
}

function gcd(x, y) {
  x = Math.abs(x);
  y = Math.abs(y);
  var t
  while(y) {
    t = y;
    y = x % y;
    x = t;
  }
  return x;
}


AFRAME.registerComponent('toolbox-shelf', {
  init() {
    this.el.addEventListener('click', (e) => {
      let action = e.target.getAttribute("click-action") + 'Action';
      if (action in this)
      {
        console.log("Running toolbox action", action)
        this[action]()
      }
      else
      {
        console.warn("No such toolbox action", action)
      }
    })
  },
  mirrorAnimationAction() {
    let compositor = document.getElementById('canvas-view').components.compositor
    compositor.activeLayer.frames = compositor.activeLayer.frames.concat(compositor.activeLayer.frames.slice(1,-1).reverse)
    compositor.el.emit('layerupdated', {layer: compositor.activeLayer})
  },
  mergeFramesAction(source, target) {
    let compositor = document.getElementById('canvas-view').components.compositor
    source = (typeof source === 'undefined') ? compositor.activeLayer : source
    let activeLayerIdx = compositor.layers.indexOf(source)
    target = (typeof target === 'undefined') ? compositor.layers[activeLayerIdx - 1] : target
    console.log("Source", source, "Target", target)
    let numFrames = lcm(source.frames.length, target.frames.length)

    let newFrames = []

    console.log("Num Frames", numFrames)

    for (let f = target.frames.length; f < numFrames; ++f)
    {
      let newFrame = document.createElement('canvas')
      newFrame.width = target.width
      newFrame.height = target.height
      let ctx = newFrame.getContext('2d')
      ctx.globalCompositeOperation = 'copy'
      ctx.drawImage(target.frame(f), 0, 0)
      ctx.globalCompositeOperation = 'source-over'
      newFrames.push(newFrame)
    }

    target.frames = target.frames.concat(newFrames)

    for (let i = 0; i < numFrames; i++)
    {
      compositor.jumpToFrame(i)
      compositor.mergeLayers(source,target)
    }

    compositor.el.emit('layerupdated', {layer: target})
    compositor.deleteLayer(source)
    compositor.activeLayer(target)
  },
  collapseLayersAction() {
    let compositor = document.getElementById('canvas-view').components.compositor
    let startIdx
    for (startIdx = 0; startIdx < compositor.layers.length; startIdx++)
    {
      if (compositor.layers[startIdx].mode.endsWith("Map")) continue;
      break
    }
    let layersToDelete = []
    for (let i = startIdx + 1; i < compositor.layers.length; i++)
    {
      if (compositor.layers[i].mode.endsWith("Map")) continue;
      this.mergeFramesAction(compositor.layers[i], compositor.layers[startIdx])
      layersToDelete.push(compositor.layers[i])
    }

    for (let layer of layersToDelete)
    {
      compositor.deleteLayer(layer)
    }
  },
  collapseLayersPerFrameAction() {
    let compositor = document.getElementById('canvas-view').components.compositor
    let startIdxs = {}
    let layersToDelete = []
    let startLength = compositor.layers.length
    for (let i = 0; i < startLength; ++i)
    {
      if (compositor.layers[i].mode.endsWith("Map")) continue;

      let frames = compositor.layers[i].frames.length
      if (!(frames in startIdxs))
      {
        compositor.addLayer(compositor.layers.length)
        startIdxs[frames] = compositor.layers[compositor.layers.length - 1]
      }

      this.mergeFramesAction(compositor.layers[i], startIdxs[frames])
      layersToDelete.push(compositor.layers[i])
    }

    for (let layer of layersToDelete)
    {
      compositor.deleteLayer(layer)
    }
  },
  exportFramesAction() {
    let numberOfFrames = parseInt(this.el.querySelector('.number-of-frames').getAttribute('text').value)
    let compositor = Compositor.component
    for (let frame = 0; frame < numberOfFrames; frame++)
    {
      compositor.jumpToFrame(frame)
      compositor.quickDraw()
      this.el.sceneEl.systems['settings-system'].exportAction({suffix: `frame-${frame}`})
    }
  },
  async recordFramesAction() {
    let numberOfFrames = parseInt(this.el.querySelector('.number-of-frames').getAttribute('text').value)
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
  async recordHeadsetAction() {
    if (!this.compositeRecorder)
    {
      this.compositeRecorder = new CanvasRecorder({canvas: document.querySelector('.a-canvas'), frameRate: 60})
      this.compositeRecorder.start()
    }
    else
    {
      await this.compositeRecorder.stop()
      this.el.sceneEl.systems['settings-system'].download(this.compositeRecorder.createURL(), `${this.el.sceneEl.systems['settings-system'].projectName}-${this.el.sceneEl.systems['settings-system'].formatFileDate()}.webm`, "Video Recording")
      delete this.compositeRecorder
    }
  },
  startSkeletonatorAction() {
    document.querySelector('#composition-view').setAttribute('skeletonator', "")
  }
})
