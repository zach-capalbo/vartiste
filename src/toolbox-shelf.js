import {CanvasRecorder} from './canvas-recorder.js'
import {Util} from './util.js'
import Gif from 'gif.js'
import {Pool} from './pool.js'
import {Undo} from './undo.js'

import './framework/SubdivisionModifier.js'
import './framework/SimplifyModifier.js'

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
    Pool.init(this)
    this.el.addEventListener('click', (e) => {
      if (e.target.hasAttribute('node-fx'))
      {
        this.applyFXAction(e.target.getAttribute('node-fx'))
        return
      }

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
  async exportGifAction() {
    let numberOfFrames = parseInt(this.el.querySelector('.number-of-frames').getAttribute('text').value)
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
    let skeletonatorEl = document.querySelector('*[skeletonator]')

    if (!skeletonatorEl)
    {
      document.querySelector('#composition-view').setAttribute('skeletonator', "")
      return
    }

    document.querySelector('*[skeletonator-control-panel]').object3D.visible = true
    skeletonatorEl.components.skeletonator.play()
  },
  bakeToVertexColorsAction() {
    let mesh = Compositor.mesh
    let vertexUvs = mesh.geometry.attributes.uv
    let uv = new THREE.Vector2()
    let colors = []
    let {width, height} = Compositor.component
    let flipY = Compositor.component.data.flipY
    let threeColor = new THREE.Color()
    let srgb = this.el.sceneEl.getAttribute('renderer').colorManagement
    for (let vi = 0; vi < vertexUvs.count; vi ++ )
    // let imageData = Compositor.component.preOverlayCanvas.getContext('2d').getImageData(0, 0, Compositor.component.width, Compositor.component.height)
    {
      let x = Math.round(uv.x * width)
      let y = Math.round(uv.y * height)
      if (flipY) y = Math.round((1.0 - uv.y) * height)
      uv.fromBufferAttribute(vertexUvs, vi)
      let color = Compositor.component.preOverlayCanvas.getContext('2d').getImageData(x, y, 1,1)

      if (srgb)
      {
        threeColor.setRGB(color.data[0] / 256.0, color.data[1] / 256.0, color.data[2] / 256.0)
        // threeColor.convertLinearToSRGB()
        colors.push(threeColor.r)
        colors.push(threeColor.g)
        colors.push(threeColor.b)
      }
      else
      {
        colors.push(color.data[0] / 255.0)
        colors.push(color.data[1] / 255.0)
        colors.push(color.data[2] / 255.0)
      }
    }
    mesh.geometry.setAttribute( 'color', new THREE.Float32BufferAttribute( colors, 3, true) );
    mesh.geometry.needsUpdate = true
  },
  toggleLatheAction() {
    document.querySelectorAll('*[lathe]').forEach(e=>e.setAttribute('lathe', {enabled: !e.getAttribute('lathe').enabled}))
  },
  presentationAction() {
    this.el.sceneEl.systems.networking.presentationMode()
  },
  captureRenderAction() {
    let {width, height} = Compositor.el.getAttribute('geometry')
    Compositor.el.object3D.updateMatrixWorld()

    let offset = new THREE.Object3D()
    Compositor.el.object3D.add(offset)
    offset.position.z += 10

    let scale = this.pool('scale', THREE.Vector3)
    scale.setFromMatrixScale(Compositor.el.object3D.matrixWorld)
    width = width * scale.x
    height = height * scale.y

    let camera = new THREE.OrthographicCamera(-width / 2, width / 2, height / 2, - height / 2, 0.1, 10)

    // Only show the canvas
    camera.layers.mask = 2
    let scene = this.el.sceneEl.object3D
    console.log("Caputreing", width, height, camera)

    scene.add(camera)
    //
    // var helper = new THREE.CameraHelper( camera );
    // scene.add( helper );

    Util.positionObject3DAtTarget(camera, offset, {scale: {x:1,y:1,z:1}})

    let oldOverlay = Compositor.component.data.drawOverlay

    Compositor.component.data.drawOverlay = false

    Compositor.component.quickDraw()

    // Compositor.el.object3D.add(camera)
    let downloadUrl = this.el.sceneEl.systems['camera-capture'].captureToCanvas(camera).toDataURL()

    Compositor.component.data.drawOverlay = oldOverlay

    let settings = this.el.sceneEl.systems['settings-system']
    settings.download(downloadUrl, `${settings.projectName}-${settings.formatFileDate()}-render.png`, "Rendered Canvas")

    scene.remove(camera)

  },
  applyFXAction(fx = "invert") {
    let layer = Compositor.component.activeLayer
    let canvas = layer.canvas
    Undo.pushCanvas(canvas)
    let processor = new CanvasShaderProcessor({fx})
    processor.setInputCanvas(canvas)
    processor.update()
    let ctx = Compositor.component.activeLayer.canvas.getContext('2d')
    let oldOperation = ctx.globalCompositeOperation
    ctx.globalCompositeOperation = 'copy'
    ctx.drawImage(processor.canvas, 0, 0)
    ctx.globalCompositeOperation = oldOperation
    layer.touch()
  },
  downloadAllLayersAction() {
    let i = 0
    Compositor.component.layers.forEach(l => this.el.sceneEl.systems['settings-system'].download(l.canvas.toDataURL(), {extension: "png", suffix: i++}, l.id))
  },
})
