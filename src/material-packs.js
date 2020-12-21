import {Util} from './util.js'
import {Layer} from './layer.js'

Util.registerComponentSystem('material-pack-system', {
  init() {
    this.tick = AFRAME.utils.throttleTick(this.tick, 100, this)
    let packRootEl = this.el.sceneEl.querySelector('#material-packs')
    packRootEl.addEventListener('summoned', this.loadPacks.bind(this))
    this.packRootEl = packRootEl
    this.loadedPacks = {}
  },
  loadPacks() {
    let packContainer = this.packRootEl.querySelector('.pack-container')
    let rc = require.context('./material-packs/', true, /.*\.jpg/)
    let x = 0
    let y = 0
    let colCount = 3
    let xSpacing = 1.1
    let ySpacing = 1.5
    for (let fileName of rc.keys())
    {
      let packName = fileName.split("/")[1]
      if (packName in this.loadedPacks) continue;
      console.log("Loading", packName)
      let el = document.createElement('a-entity')
      packContainer.append(el)
      el.setAttribute('material-pack', `pack: ${packName}`)
      el.setAttribute('position', `${x * xSpacing} ${y * ySpacing} 0`)
      this.loadedPacks[packName] = el
      if (++x === colCount) {
        x = 0
        y++
      }
    }
  },
  activateMaterialMask(mask) {
    this.activeMaterialMask = mask
    Compositor.el.setAttribute('material', 'shader', 'standard')
  },
  tmpCanvas() {
    if (!this._tmpCanvas)
    {
      this._tmpCanvas = document.createElement('canvas')
    }
    if (this._tmpCanvas.width !== Compositor.component.width || this._tmpCanvas.height !== Compositor.component.height)
    {
      this._tmpCanvas.width = Compositor.component.width
      this._tmpCanvas.height = Compositor.component.height
    }
    this._tmpCtx = this._tmpCanvas.getContext('2d')
    return this._tmpCanvas
  },
  tmpCtx() {
    this.tmpCanvas()
    return this._tmpCtx
  },
  tick(t,dt) {
    if (this.activeMaterialMask)
    {
      this.activeMaterialMask.applyMask()
    }
  }
})

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
    this.system = this.el.sceneEl.systems['material-pack-system'];
    this.el.innerHTML = require('./partials/material-pack.html.slm')
    this.view = this.el.querySelector('.view')
    Util.whenLoaded(this.view, () => {
      this.loadTextures()
      this.el.children[0].setAttribute('frame', 'name', this.data.pack)
    })
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
  activateMask(e) {
    if (this.system.activeMaterialMask === this)
    {
      this.system.activeMaterialMask = undefined
      this.deactivateMask()
      return
    }

    if (this.system.activeMaterialMask)
    {
      this.system.activeMaterialMask.deactivateMask()
    }

    this.system.activateMaterialMask(this)
    this.el.querySelector('*[click-action="activateMask"]').components['toggle-button'].data.toggled = true
    this.el.querySelector('*[click-action="activateMask"]').components['toggle-button'].setToggle(true)
  },
  deactivateMask() {
    this.el.querySelector('*[click-action="activateMask"]').components['toggle-button'].data.toggled = false
    this.el.querySelector('*[click-action="activateMask"]').components['toggle-button'].setToggle(false)
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
    let tmpCanvas = this.system.tmpCanvas()
    let maskCanvas = Compositor.drawableCanvas
    let tmpCtx = this.system.tmpCtx()

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
        layer = Compositor.component.layers.find(l => l.id === 'material-pack')
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
          layer.id = 'material-pack'
          Compositor.component.addLayer(undefined, {layer})
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
})

AFRAME.registerComponent('material-draw', {

})
