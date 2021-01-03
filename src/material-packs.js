import {Util} from './util.js'
import {Layer} from './layer.js'
import {Undo} from './undo.js'
import {toSrcString} from './file-upload.js'

const HANDLED_MAPS = ['normalMap', 'emissiveMap', 'metalnessMap', 'roughnessMap'];

Util.registerComponentSystem('material-pack-system', {
  events: {
    layerupdated: function(e) {
      if (!this.activeMaterialMask) return;
      if (this.activeMaterialMask.isApplying) return;
      this.activeMaterialMask.deactivateMask()
      this.activeMaterialMask = undefined
    },
    startdrawing: function(e) {
      if (!this.activeMaterialMask || !Undo.enabled) return
      this.oldUndo = Undo.pushCanvas
      this.undid = true
      Undo.pushCanvas = () => {
        console.log("Trying to push material undo")
        Undo.pushCanvas = this.oldUndo
        Undo.collect(() => {
          let currentFrame = Compositor.component.currentFrame
          let src = Compositor.component.layers.find(l => l.id === 'material-pack')
          if (src) Undo.pushCanvas(src.frame(currentFrame))
          for (let map in this.defaultMap)
          {
            let layer = Compositor.component.layers.find(l => l.mode === map)
            if (!layer) continue;
            Undo.pushCanvas(layer.frame(currentFrame))
          }
        })
        Undo.pushAllowed = false
      };
    },
    enddrawing: function(e) {
      if (!this.undid) return
      Undo.pushAllowed = true
      Undo.pushCanvas = this.oldUndo
      this.undid = false
    }
  },
  init() {
    this.tick = AFRAME.utils.throttleTick(this.tick, 100, this)
    let packRootEl = this.el.sceneEl.querySelector('#material-packs')
    this.loadPacks = this.loadPacks.bind(this)
    packRootEl.addEventListener('summoned', this.loadPacks)
    this.packRootEl = packRootEl
    this.loadedPacks = {}
    this.interceptFile = this.interceptFile.bind(this)
    packRootEl.addEventListener('componentchanged', (e) => {
      if (e.detail.name === 'visible')
      {
        if (packRootEl.getAttribute('visible'))
        {
          this.el.sceneEl.systems['file-upload'].fileInterceptors.push(this.interceptFile)
        }
        else
        {
          this.el.sceneEl.systems['file-upload'].fileInterceptors.splice(this.el.sceneEl.systems['file-upload'].fileInterceptors.indexOf(this.interceptFile), 1)
        }
      }
    })

    this.defaultMap = {};
    for (let map of HANDLED_MAPS)
    {
      let canvas = document.createElement('canvas')
      canvas.width = 24
      canvas.height = 24
      canvas.id = 'default-' + map
      Util.fillDefaultCanvasForMap(canvas, map)
      this.defaultMap[map] = canvas
    }

    this.colCount = 3
    this.xSpacing = 1.1
    this.ySpacing = 1.5
    this.x = 0
    this.y = 0
  },
  loadPacks() {
    this.packRootEl.removeEventListener('summoned', this.loadPacks)
    let packContainer = this.packRootEl.querySelector('.pack-container')
    let rc = require.context('./material-packs/', true, /.*\.jpg/)

    for (let fileName of rc.keys())
    {
      let packName = fileName.split("/")[1]
      if (packName in this.loadedPacks) continue;
      console.log("Loading", packName)
      let el = document.createElement('a-entity')
      packContainer.append(el)
      el.setAttribute('material-pack', `pack: ${packName}`)
      el.setAttribute('rotation', '-15 0 0')
      el.setAttribute('position', `${this.x * this.xSpacing} -${this.y * this.ySpacing} 0`)
      this.loadedPacks[packName] = el
      if (++this.x === this.colCount) {
        this.x = 0
        this.y++
      }
    }
  },
  interceptFile(items)
  {
    let hidden = false;
    this.packRootEl.object3D.traverseAncestors(o => {
      if (!o.visible) hidden = true
    })
    if (hidden) return false;
    console.log("Intercepting files for material", items)
    let itemsToRemove = []
    let attr = {}
    let hasAttr = false
    for (let i = 0; i < items.length; ++i)
    {
      let item = items[i];
      if (item.kind !== 'file') continue
      let file = item.getAsFile()
      let isImage = item.type ? /image\//.test(item.type) : /\.(png|jpg|jpeg|bmp|svg)$/i.test(file.name)
      if (!isImage) continue

      let img = new Image()
      img.src = toSrcString(file)
      let map = Util.mapFromFilename(file.name)
      if (!map) {
        map = 'src'
      }
      if (map === 'displacementMap') {
        console.warn("Ignoring displacement map for the time being")
        continue;
      }
      attr[map] = img
      hasAttr = true
    }
    if (hasAttr) {
      this.addMaterialPack(attr)
      return true
    }

    return false
  },
  addMaterialPack(attr) {
    let promises = Object.values(attr).map(i => i.decode && i.decode() || Promise.resolve())
    attr.shader = 'standard'
    let el = document.createElement('a-entity')
    let packContainer = this.packRootEl.querySelector('.pack-container')
    packContainer.append(el)
    el.classList.add("user")
    el.setAttribute('material-pack', '')
    el.setAttribute('rotation', '-15 0 0')
    el.setAttribute('position', `${this.x * this.xSpacing} -${this.y * this.ySpacing} 0`)
    if (++this.x === this.colCount)
    {
      this.x = 0;
      this.y++;
    }
    promises.push(Util.whenLoaded(el))
    Promise.all(promises).then(() => {
      Util.whenLoaded(el, () => {
        if (attr.emissiveMap)
        {
          attr.emissive = attr.emissiveMap
          delete attr.emissiveMap
        }
        el.components['material-pack'].view.setAttribute('material', attr)
        delete attr.shader
        el.components['material-pack'].maps = attr
      })
    })
  },
  addPacksFromObjects(obj) {
    function fakeImgFromImageBitmap(img) {
      if (!('tagName' in img))
      {
        img.tagName = 'IMG'
      }
      if (!('id' in img))
      [
        img.id = ""
      ]
    }
    let bitmapToImage = (bmp) => {
      let canvas = this.tmpCanvas()
      let ctx = this.tmpCtx()
      ctx.globalCompositeOperation = 'source-over'
      ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height)
      let img = new Image();
      img.src = canvas.toDataURL()
      return img
    }
    obj.traverse(o => {
      if (!o.material || o.material.type === 'MeshBasicMaterial') return;

      let hasAttr = false
      let attr = {}
      for (let m of HANDLED_MAPS)
      {
        if (!o.material[m] || !o.material[m].image) continue;
        attr[m] = bitmapToImage(o.material[m].image)
        hasAttr = true
      }
      if (o.material.map && o.material.map.image) {
        attr.src = bitmapToImage(o.material.map.image)
        hasAttr = true
      }
      if (hasAttr) {
        console.log("Creating mateiral pack", attr)
        this.addMaterialPack(attr)
      }
    })
  },
  activateMaterialMask(mask) {
    this.activeMaterialMask = mask
    Compositor.el.setAttribute('material', 'shader', 'standard')
    if (!Util.isCanvasFullyTransparent(Compositor.drawableCanvas))
    {
      Undo.collect(() => {
        Undo.pushCanvas(Compositor.drawableCanvas)
        Undo.push(() => {
          if (this.activeMaterialMask)
          {
            this.activeMaterialMask.deactivateMask()
            this.activeMaterialMask = undefined
          }
        })
      })
    }
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
      Undo.block(this.activeMaterialMask.applyMask)
    }
  }
})

// Avoid garbage
const ENABLED_MAP = {'src': 'srcEnabled'}
for (let m of HANDLED_MAPS)
{
  ENABLED_MAP[m] = m + "Enabled"
}

AFRAME.registerComponent('material-pack', {
  schema: {
    pack: {type: 'string'},
    applyMask: {default: false},

    srcEnabled: {default: true},
    normalMapEnabled: {default: true},
    metalnessMapEnabled: {default: true},
    roughnessMapEnabled: {default: true},
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
    this.applyMask = this.applyMask.bind(this)
    Util.whenLoaded(this.view, () => {
      if (this.data.pack) this.loadTextures()
      this.el.children[0].setAttribute('frame', 'name', this.data.pack)
    })
    this.el.querySelectorAll('.map-row > *[icon-button]').forEach(el => {
      Util.whenLoaded(el, () => {
        el.setAttribute('toggle-button', {target: this.el, component: 'material-pack', property: ENABLED_MAP[el.getAttribute('map')]})
      })
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
      if (map === 'multiply' || map === 'displacementMap')
      {
        console.warn("Map", map, "not currently supported. Skipping")
        continue;
      }
      let img = document.createElement('img')
      img.src = rc(fileName)

      promises.push(new Promise(r => img.onload = r))
      attr[map] = img
    }

    await Promise.all(promises)
    this.view.setAttribute('material', attr)
    this.maps = attr
    delete this.maps.shader

    for (let map in this.system.defaultMap)
    {
      if (map in this.maps) continue;
      this.maps[map] = this.system.defaultMap[map]
    }
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
    this.el.querySelector('*[expandable-shelf]').setAttribute('expandable-shelf', 'expanded', true)
  },
  deactivateMask() {
    this.el.querySelector('*[click-action="activateMask"]').components['toggle-button'].data.toggled = false
    this.el.querySelector('*[click-action="activateMask"]').components['toggle-button'].setToggle(false)
    this.el.querySelector('*[expandable-shelf]').setAttribute('expandable-shelf', 'expanded', false)
  },
  fillMaterial() {
    Compositor.el.setAttribute('material', 'shader', 'standard')
    let canvas = Compositor.drawableCanvas
    canvas.getContext('2d').fillRect(0, 0, canvas.width, canvas.height)
    this.applyMask()

  },
  applyMask() {
    this.isApplying = true
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
        if (!this.data[ENABLED_MAP[map]]) continue;
        layer = Compositor.component.layers.find(l => l.mode === map)
      }
      if (!layer)
      {
        if (this.maps[map].id.startsWith('default-')) continue;

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
      if (!this.data[ENABLED_MAP[map]])
      {
        // tmpCtx.globalCompositeOperation = 'color'
        tmpCtx.drawImage(maskCanvas, 0, 0, tmpCanvas.width, tmpCanvas.height,)
        // tmpCtx.globalCompositeOperation = 'source-in'
      }
      let ctx = canvas.getContext('2d')
      ctx.drawImage(tmpCanvas, 0, 0, canvas.width, canvas.height)
      layer.touch()
      if (canvas.touch) canvas.touch()
      layer.needsUpdate = true
    }

    maskCanvas.getContext('2d').clearRect(0, 0, maskCanvas.width, maskCanvas.height)

    Compositor.component.activateLayer(startingActiveLayer)
    this.isApplying = false

    Undo.push(() => {
      if (this.activeMaterialMask) this.activeMaterialMask.deactivateMask()
      this.activeMaterialMask = undefined
    })
  },
})

AFRAME.registerComponent('material-draw', {

})
