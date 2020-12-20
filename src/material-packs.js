import {Util} from './util.js'
import {Layer} from './layer.js'
AFRAME.registerComponent('material-pack', {
  schema: {
    pack: {type: 'string'},
    applyMask: {default: false},
  },
  events: {
    click: function(e) {
      if (!e.target.hasAttribute('click-action')) return
      let action = e.target.getAttribute('click-action')
      if (!(action in this)) return
      this[action](e);
    }
  },
  init() {
    this.el.innerHTML = require('./partials/material-pack.html.slm')
    this.view = this.el.querySelector('.view')
    Util.whenLoaded(this.view, () => {
      this.loadTextures()
    }),
    this.tick = AFRAME.utils.throttleTick(this.tick, 100, this)
  },
  async loadTextures() {
    let promises = []
    let attr = {shader: 'standard'}

    let rc = require.context('./material-packs/', true, /.*\.jpg/);
    for (let fileName of rc.keys())
    {
      if (!fileName.startsWith("./" + this.data.pack + "/")) continue;
      console.log("Getting file", fileName)
      let map = Util.mapFromFilename(fileName)
      if (!map) {
        map = 'src'
      }
      let img = document.createElement('img')
      img.src = rc(fileName)
      promises.push(img.decode())
      attr[map] = img
    }

    await Promise.all(promises)
    this.view.setAttribute('material', attr)
    this.maps = attr
    delete this.maps.shader
  },
  fillMaterial() {
    for (let map in this.maps)
    {
      let canvas
      if (map === 'src')
      {
        canvas = Compositor.drawableCanvas
      }
      else
      {
        let layer = Compositor.component.layers.find(l => l.mode === map)
        if (!layer)
        {

          layer = new Layer(Compositor.component.width, Compositor.component.height)
          Compositor.component.addLayer(0, {layer})
          Compositor.component.setLayerBlendMode(layer, map)
          canvas = layer.canvas
        }
        canvas = layer.frame(Compositor.component.currentFrame)
      }

      canvas.getContext('2d').drawImage(this.maps[map], 0, 0, canvas.width, canvas.height,)
    }
  },
  applyMask() {
    this.data.applyMask = true
    if (!this.tmpCanvas) {
      this.tmpCanvas = document.createElement('canvas')
      this.tmpCanvas.width = Compositor.component.width
      this.tmpCanvas.height = Compositor.component.height
    }

    let tmpCanvas = this.tmpCanvas
    let maskCanvas = Compositor.drawableCanvas
    let tmpCtx = tmpCanvas.getContext('2d')

    tmpCtx.globalCompositeOperation = 'copy'
    tmpCtx.drawImage(maskCanvas, 0, 0)

    tmpCtx.globalCompositeOperation = 'source-in'

    let startingActiveLayer = Compositor.component.activeLayer

    for (let map in this.maps)
    {
      let canvas
      let layer
      if (map === 'src')
      {
        layer = Compositor.component.layers.find(l => l.id === this.data.pack)
      }
      else
      {
        layer = Compositor.component.layers.find(l => l.mode === map)
      }
      if (!layer)
      {
        layer = new Layer(Compositor.component.width, Compositor.component.height)
        if (map === 'src')
        {
          layer.id = this.data.pack
          Compositor.component.addLayer(0, {layer})
        }
        else
        {
          Compositor.component.addLayer(0, {layer})
          Compositor.component.setLayerBlendMode(layer, map)
        }
      }
      canvas = layer.frame(Compositor.component.currentFrame)

      tmpCtx.drawImage(this.maps[map], 0, 0, tmpCanvas.width, tmpCanvas.height,)
      let ctx = canvas.getContext('2d')
      ctx.drawImage(tmpCanvas, 0, 0, canvas.width, canvas.height)
      if (canvas.touch) canvas.touch()
      layer.needsUpdate = true
    }

    maskCanvas.getContext('2d').clearRect(0, 0, maskCanvas.width, maskCanvas.height)

    Compositor.component.activateLayer(startingActiveLayer)
  },
  tick(t, dt) {
    if (!this.data.applyMask) return
    this.applyMask()
  }
})

AFRAME.registerComponent('material-draw', {

})
