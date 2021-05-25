import {CanvasRecorder} from './canvas-recorder.js'
import {Util} from './util.js'
// import Gif from 'gif.js'
import {Pool} from './pool.js'
import {Undo} from './undo.js'
import {THREED_MODES} from './layer-modes.js'
import {Layer} from './layer.js'
import {bumpCanvasToNormalCanvas} from './material-transformations.js'
import {base64ArrayBuffer} from './framework/base64ArrayBuffer.js'

const { createFFmpeg, fetchFile } = require('@ffmpeg/ffmpeg');

window.ffmpeg = createFFmpeg({ log: true });
window.fetchFile = fetchFile;

console.error("Need to import ffmpeg, not load")

Util.registerComponentSystem('timeline-system', {
  schema: {
    endFrameNumber: {default: 10},
  },
  init() {
    Pool.init(this)
  },
  playPauseAnimation() {
    Compositor.component.playPauseAnimation()
  },
  nextFrame() {
    Compositor.component.nextFrame()
  },
  previousFrame() {
    Compositor.component.previousFrame()
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
    await this.exportFFMPEG({extension: 'gif', args: ["-filter_complex", "[0:v] split [a][b];[a] palettegen [p];[b][p] paletteuse"]})
  },
  async exportMP4() {
    await this.exportFFMPEG({extension: 'mp4', args: ["-pix_fmt", "yuv420p"]})
  },
  async exportFFMPEG({extension, args}) {
    let numberOfFrames = this.data.endFrameNumber
    let compositor = Compositor.component
    let ffmpeg = window.ffmpeg

    if (!ffmpeg.isLoaded())
    {
      await ffmpeg.load()
    }

    for (let frame = 0; frame < numberOfFrames; frame++)
    {
      compositor.jumpToFrame(frame)
      compositor.quickDraw()
      ffmpeg.FS('writeFile', `${frame}`.padStart("0", Math.ceil(Math.log10(numberOfFrames + 1))) + ".png", await fetchFile(Compositor.component.preOverlayCanvas.toDataURL()))
      // (Compositor.component.preOverlayCanvas, {copy: true, delay: 1000 / Compositor.component.data.frameRate})
    }

    await ffmpeg.run('-r', `${Compositor.component.data.frameRate}`, '-i', '%d.png', ...args, `output.${extension}`);
    // await ffmpeg.run('-r', `${Compositor.component.data.frameRate}`, '-i', '%d.png', "-pix_fmt", "yuv420p", `output.${extension}`);

    let data = ffmpeg.FS('readFile', `output.${extension}`);

    // console.log(array)

    // let url = await new Promise((r, e) => {
    //   gif.on('finished', function(blob) {
    //     r(URL.createObjectURL(blob))
    //   });
    //
    //   try { gif.render(); } catch (ex)  { e(ex) }
    // })

    this.el.sceneEl.systems['settings-system'].download("data:application/x-binary;base64," + base64ArrayBuffer(data), {extension}, "Animation")
  },
  makeUVScrollable({direction} = {}) {
    let numberOfFrames = this.data.endFrameNumber
    let compositor = Compositor.component
    let {width, height} = compositor

    compositor.data.wrapTexture = true

    let isDrawingOnly = Compositor.mesh === Compositor.el.getObject3D('mesh')

    if (typeof direction === 'undefined') direction = width > height ? 'y' : 'x'

    let fullWidth = direction === 'x' ? width * numberOfFrames : width
    let fullHeight = direction === 'y' ? height * numberOfFrames : height

    let createCanvas = () => {
      let layer = new Layer(fullWidth, fullHeight)
      return {layer, canvas: layer.canvas, ctx: layer.canvas.getContext('2d')}
    }

    compositor.data.usePreOverlayCanvas = true

    let tmpBumpCanvas = document.createElement('canvas')

    let canvases = {"map": createCanvas()}
    for (let frameIdx = 0; frameIdx < numberOfFrames; frameIdx++)
    {
      compositor.jumpToFrame(frameIdx)
      compositor.quickDraw()
      canvases.map.ctx.drawImage(compositor.preOverlayCanvas, 0,0, width, height,
                                                              direction === 'x' ? width * frameIdx : 0,
                                                              direction === 'y' ? height * frameIdx : 0,
                                                              width, height)

      for (let mode of THREED_MODES)
      {
        if (!(Compositor.material[mode] && Compositor.material[mode].image)) continue
        if (mode === 'envMap') continue
        if (!canvases[mode]) {
          canvases[mode] = createCanvas()
          canvases[mode].layer.mode = mode
        }

        if (mode === 'bumpMap') {
          // let layer = canvases[mode]
          // delete canvases.bumpMap
          // mode = "normalMap"
          // layer.mode = "normalMap"
          // bumpCanvasToNormalCanvas(Compositor.material.bumpMap.image, {bumpScale: Compositor.material.bumpScale})
          canvases[mode].layer.opacity = Math.pow(Compositor.material.bumpScale, 1.0 / 2.2)

        }

        canvases[mode].ctx.drawImage(Compositor.material[mode].image, 0,0, width, height,
                                                                direction === 'x' ? width * frameIdx : 0,
                                                                direction === 'y' ? height * frameIdx : 0,
                                                                width, height)
      }
    }

    for (let layer of compositor.layers)
    {
      layer.visible = false
    }

    compositor.resize(fullWidth, fullHeight, {resizeGeometry: !isDrawingOnly})
    for (let m of Object.values(canvases))
    {
      compositor.addLayer(compositor.layers.length - 1, {layer: m.layer})
    }

    let uv = new THREE.Vector2()
    for (let o of Compositor.meshes)
    {
      if (!o.geometry || !o.geometry.attributes.uv) continue
      if (!isDrawingOnly && o === Compositor.el.getObject3D('mesh')) continue
      let attr = o.geometry.attributes.uv
      let geometry = o.geometry
      //geometry = geometry.toNonIndexed()

      if (attr.data)
      {
        for (let i = 0; i < attr.count; ++i)
        {
          attr.setXY(i,
            direction === 'x' ? attr.getX(i) / numberOfFrames : attr.getX(i) ,
            direction === 'y' ? attr.getY(i) / numberOfFrames : attr.getY(i))
        }
      }
      else
      {
        for (let i in geometry.attributes.uv.array) {
          if (i %2 == 0) {
            attr.array[i] = direction === 'x' ? attr.array[i] / numberOfFrames : attr.array[i]
          }
          else
          {
            attr.array[i] = direction === 'y' ? attr.array[i] / numberOfFrames : attr.array[i]
          }
        }
      }
      //o.geometry = geometry
      geometry.attributes.uv.needsUpdate = true

      let speed = 1 / (numberOfFrames / compositor.data.frameRate)
      if (!o.userData.gltfExtensions) o.userData.gltfExtensions = {}
      o.userData.gltfExtensions.MOZ_hubs_components = {
        "uv-scroll": {
          speed: {
            x: direction === 'x' ? speed : 0,
            y: direction === 'y' ? speed : 0,
          },
          increment: {
            x: direction === 'x' ? 1.0 / numberOfFrames : 0,
            y: direction === 'y' ? 1.0 / numberOfFrames : 0,
          }
        }
      }
    }
  },
  async recordFrames() {
    let numberOfFrames = this.data.endFrameNumber
    let compositor = Compositor.component

    compositor.setIsPlayingAnimation(false)
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
