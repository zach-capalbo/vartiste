import {Util} from './util.js'
import {Layer} from './layer.js'
AFRAME.registerComponent('material-pack', {
  schema: {
    pack: {type: 'string'}
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
    })
  },
  async loadTextures() {
    let promises = []
    let attr = {shader: 'standard'}

    for (let map of ['src', 'normalMap', 'roughnessMap'])
    {
      let img = document.createElement('img')
      img.src = require(`./material-packs/${this.data.pack}/${this.data.pack}_${map}.jpg`)
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

      tmpCtx.drawImage(this.maps[map], 0, 0, tmpCanvas.width, tmpCanvas.height,)
      let ctx = canvas.getContext('2d')

      if (map === 'src')
      {
        ctx.globalCompositeOperation = 'copy'
      }

      ctx.drawImage(tmpCanvas, 0, 0, canvas.width, canvas.height)

      if (map === 'src')
      {
        ctx.globalCompositeOperation = 'source-over'
      }

      if (canvas.touch) canvas.touch()
    }

    Compositor.component.activateLayer(startingActiveLayer)
  }
})

AFRAME.registerComponent('material-draw', {

})
