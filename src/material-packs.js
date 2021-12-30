import {Util} from './util.js'
import {Layer} from './layer.js'
import {Undo} from './undo.js'
import {toSrcString} from './file-upload.js'
import shortid from 'shortid'

export const HANDLED_MAPS = ['normalMap', 'emissiveMap', 'metalnessMap', 'roughnessMap', 'aoMap'];

Util.registerComponentSystem('material-pack-system', {
  events: {
    layerupdated: function(e) {
      if (this.addingLayer)
      {
        // this.addingLayer = false
        return
      }
      if (!this.activeMaterialMask) return;
      if (this.activeMaterialMask.isApplying) return;
      this.activeMaterialMask.deactivateMask()
      this.activeMaterialMask = undefined
    },
    startdrawing: function(e) {
      if (!this.activeMaterialMask || !Undo.enabled || this.oldUndo) return
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
      delete this.oldUndo
      this.undid = false
    }
  },
  init() {
    this.tick = AFRAME.utils.throttleTick(this.tick, Util.isLowPower() ? 300 : 50, this)
    this.downloadUserMaterials = Util.busify({title: 'Packing user materials...'}, this.downloadUserMaterials, this)
    this.addPacksFromObjects = Util.busify({title: "Adding material packs..."}, this.addPacksFromObjects, this)
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
      console.log("Creating default", map)
      let canvas = document.createElement('canvas')
      canvas.width = 24
      canvas.height = 24
      canvas.id = 'default-' + map
      Util.fillDefaultCanvasForMap(canvas, map)
      this.defaultMap[map] = canvas
    }

    this.colCount = 3
    this.xSpacing = 1.4
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
    this.hasLoadedPacks = true
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
    let name = shortid.generate()
    for (let i = 0; i < items.length; ++i)
    {
      let item = items[i];
      console.log("Checking", item, item instanceof Blob, item.kind)
      if (item.kind !== 'file' && !(item instanceof Blob)) continue
      let file = (item instanceof Blob) ? item : item.getAsFile()
      let isImage = item.type ? /image\//.test(item.type) : /\.(png|jpg|jpeg|bmp|svg)$/i.test(file.name)
      console.log("IsImage", isImage)
      if (!isImage) continue

      let img = new Image()
      img.src = toSrcString(file)
      let map = Util.mapFromFilename(file.name)
      if (!map) {
        map = 'src'
        name = file.name.split(".", 1)[0]
      }
      if (file.name.endsWith("_PREVIEW.jpg")) {
        console.log("Skipping preview", file.name)
        continue;
      }
      if (file.name.endsWith('_Opacity.jpg')) {
        console.log("Skipping opacity", file.name)
        continue;
      }

      if (map === 'displacementMap') {
        console.warn("Ignoring displacement map for the time being")
        continue;
      }
      attr[map] = img
      hasAttr = true
    }
    if (hasAttr) {
      this.addMaterialPack(attr, name)
      return true
    }

    return false
  },
  addCanvasMaterial() {
    Compositor.component.data.drawOverlay = false
    Compositor.component.quickDraw()

    this.addPacksFromObjects(Compositor.el.getObject3D('mesh'))

    Compositor.component.data.drawOverlay = true
  },
  addMaterialPack(attr, name, {flipY = false} = {}) {
    if (!name) name = shortid.generate();
    console.log("Adding material pack", name)

    for (let map in this.defaultMap)
    {
      if (map in attr) continue;
      attr[map] = this.defaultMap[map]
    }


    let promises = Object.values(attr).map(i => i.decode && i.decode() || Promise.resolve())
    attr.shader = 'standard'
    let el = document.createElement('a-entity')
    let packContainer = this.packRootEl.querySelector('.pack-container')
    packContainer.append(el)
    el.classList.add("user")
    el.setAttribute('material-pack', `flipY: ${flipY}`)
    el.setAttribute('rotation', '-15 0 0')
    el.setAttribute('position', `${this.x * this.xSpacing} -${this.y * this.ySpacing} 0`)
    if (++this.x === this.colCount)
    {
      this.x = 0;
      this.y++;
    }
    promises.push(Util.whenLoaded(el))
    return Promise.all(promises).then(() => {
      return Util.whenLoaded(el, () => {
        this.loadedPacks[name] = el;
        el.setAttribute('material-pack', 'pack', name)
        if (attr.emissiveMap)
        {
          attr.emissive = attr.emissiveMap
          delete attr.emissiveMap
        }
        if (attr.multiply)
        {
          delete attr.multiply
        }
        if (attr.aoMap)
        {
          attr.ambientOcclusionMap = attr.aoMap
          delete attr.aoMap
        }
        el.components['material-pack'].view.setAttribute('material', attr)
        delete attr.shader
        if (attr.ambientOcclusionMap) {
          attr.aoMap = attr.ambientOcclusionMap
          delete attr.ambientOcclusionMap
        }
        el.components['material-pack'].maps = attr

        // A-Frame material doesn't handle emissive maps for some reason...
        if (attr.emissive)
        {
          // console.log("Special handling for emissive", attr, el.components['material-pack'])
          el.components['material-pack'].view.components.material.material.emissiveMap = new THREE.Texture(attr.emissive)
          el.components['material-pack'].view.components.material.material.emissive.setRGB(1,1,1)
          attr.emissiveMap = attr.emissive
          delete attr.emissive
        }
      })
    })
  },
  async addPacksFromObjects(obj) {
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
    this.packFromObjectCanvas = (this.packFromObjectCanvas || document.createElement('canvas'));

    let bitmapToImage = async (bmp, flipY) => {
      if (bmp.tagName === 'IMG') return bmp;
      console.log("Converting", bmp)
      let canvas = this.packFromObjectCanvas
      if (canvas.width !== bmp.width || canvas.height !== bmp.height)
      {
        canvas.width = Math.min(bmp.width, 2048);
        canvas.height = Math.min(bmp.height, 2048);
      }
      let ctx = canvas.getContext('2d')
      ctx.save()
      ctx.globalCompositeOperation = 'source-over'
      if (flipY)
      {
        ctx.scale(1, -1)
        ctx.drawImage(bmp, 0, -canvas.height, canvas.width, canvas.height)
      }
      else
      {
        ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height)
      }
      ctx.restore()
      let img = new Image();
      await new Promise((r, err) => {
        try {
          canvas.toBlob(blob => {
            img.src = URL.createObjectURL(blob, 'image/jpeg')
            r()
          })
        } catch (e) {
          err(e)
        }
      })

      return img
    }
    let objects = Util.traverseFindAll(obj, o => (o.material && o.material.type !== 'MeshBasicMaterial'));
    let promises = []
    // let c = new CanvasShaderProcessor({fx: 'flip-y'})
    for (let o of objects)
    {
      promises.push((async () => {
        let hasAttr = false
        let attr = {}
        for (let m of HANDLED_MAPS)
        {
          if (!o.material[m] || !o.material[m].image) continue;
          if (false && o.material[m].flipY) {
            // c.setInputCanvas(o.material[m].image)
            // c.update()
            // attr[m] = Util.cloneCanvas(c.canvas)
          }
          else
          {
            attr[m] = await bitmapToImage(o.material[m].image, true)
          }

          if (m === 'metalnessMap')
          {
            attr["metalness"] = 1
          }

          hasAttr = true
        }
        if (o.material.map && o.material.map.image) {
          attr.src = await bitmapToImage(o.material.map.image, true)
          hasAttr = true
        }
        if (hasAttr) {
          this.addMaterialPack(attr, o.material.name, {flipY: true})
        }
      })());

      // await Util.delay(1)
    }

    await Promise.all(promises)
  },
  async downloadUserMaterials() {
    let materialPackRoot = new THREE.Object3D
    document.querySelectorAll('.user[material-pack] .view').forEach(el => {
      let o = el.getObject3D('mesh').clone()
      o.material.name = el.parentEl.getAttribute('material-pack').pack
      materialPackRoot.add(o)
    })
    let settings = this.el.sceneEl.systems['settings-system'];
    if (materialPackRoot.children.length)
    {
      materialPackRoot.traverse(mesh => {
        if (mesh.material) {
          for (let m of ["map"].concat(HANDLED_MAPS))
          {
            if (mesh.material[m]) {
              // mesh.material[m].flipY = false
            }
          }
        }
      //   if (!mesh.material) return;
      //   if (!mesh.material.normalScale || !mesh.material.normalScale.toArray)
      //   {
      //     mesh.material.normalScale = new THREE.Vector2(1, 1);
      //   }
      })
      // await settings.downloadCompressed(JSON.stringify(materialPackRoot.toJSON()), {extension: 'materialpack'}, 'Material Pack')
      let oldExportJPEG = settings.data.exportJPEG
      settings.data.exportJPEG = true
      try {
        settings.compressionQualityOverride = 0.85
        await settings.export3dAction(materialPackRoot, {extension: 'materialpack'})
      }
      finally {
        settings.data.exportJPEG = oldExportJPEG
      }
    }
  },
  flipUserPacks() {
    c = new CanvasShaderProcessor({fx: 'flip-y'})
    document.querySelectorAll('.user[material-pack] .view').forEach(el => {
        for (let m of ['normalMap', 'emissiveMap', 'metalnessMap', 'roughnessMap', 'aoMap', 'map']) {
        if (!el.getObject3D('mesh').material[m]) continue;
        c.setInputCanvas(el.getObject3D('mesh').material[m].image)
        c.update()
        el.getObject3D('mesh').material[m].image = VARTISTE.Util.cloneCanvas(c.canvas)
        el.getObject3D('mesh').material[m].needsUpdate = true
        }
    })
  },
  previewMaterial(mask) {
    if (mask in this.loadedPacks)
    {
      return this.loadedPacks[mask].components["material-pack"].view.components.material.material
    }
  },
  activateMaterialMask(mask) {
    this.activeMaterialMask = mask
    Compositor.el.setAttribute('material', 'shader', 'standard')
    if (!Util.isCanvasFullyTransparent(Compositor.drawableCanvas))
    {
      Undo.collect(() => {
        // Undo.pushCanvas(Compositor.drawableCanvas)
        this.addingLayer = true
        Compositor.component.addLayer(Math.max(0, Compositor.component.layers.indexOf(Compositor.component.activeLayer) - 1))
        this.addingLayer = false
        Undo.push(() => {
          if (this.activeMaterialMask)
          {
            this.activeMaterialMask.deactivateMask()
            this.activeMaterialMask = undefined
          }
        })
      })
    }
    this.el.emit('materialmaskactivated', {mask})
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
    if (Compositor.component.loading) return;

    for (let i = 0; i < Compositor.component.layers.length; ++i)
    {
      let layer = Compositor.component.layers[i]
      if (!layer.materialPack) continue;
      if (!layer.visible) continue;
      let layerPack = this.loadedPacks[layer.materialPack];
      if (!layerPack) {
        if (!this.hasLoadedPacks)
        {
          console.log("Trying to load packs")
          this.loadPacks()
          return;
        }

        console.warn("Unknown materialpack", layer.materialPack);
        continue
      }
      Undo.block(() => layerPack.components['material-pack'].applyMask({maskCanvas: layer.frame(Compositor.component.currentFrame), eraseMask: false}))
    }

    if (this.activeMaterialMask)
    {
      Undo.block(this.activeMaterialMask.applyMask)
    }
  }
})

// Avoid garbage
export const ENABLED_MAP = {'src': 'srcEnabled'}
for (let m of HANDLED_MAPS)
{
  ENABLED_MAP[m] = m + "Enabled"
}

AFRAME.registerComponent('material-pack', {
  schema: {
    pack: {type: 'string'},
    applyMask: {default: false},
    repeat: {default: 1},
    rotations: {default: 0},

    flipY: {default: false},

    srcEnabled: {default: true},
    normalMapEnabled: {default: true},
    metalnessMapEnabled: {default: true},
    roughnessMapEnabled: {default: true},
    emissiveMapEnabled: {default: true},
    aoMapEnabled: {default: true},
  },
  events: {
    click: function(e) {
      if (!e.target.hasAttribute('click-action')) return
      let action = e.target.getAttribute('click-action')
      if (!(action in this)) return
      this[action](e);
    },
    materialtextureloaded: function (e) {
      this.updateRepeat()
    },
    popupaction: function(e) {
      e.stopPropagation()
      if (e.detail === 'close')
      {
        this.remove()
        this.el.remove()
        this.view.remove()
      }
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
  remove() {
    console.log("Disposing material pack")
    Util.callLater(() => Util.recursiveDispose(this.view))
  },
  update(oldData) {
    if (this.repeat !== oldData.repeat) {
      this.updateRepeat()
    }
    Util.whenLoaded(this.view, () => {
      this.el.children[0].setAttribute('frame', 'name', this.data.pack)
    })
  },
  updateRepeat() {
    if (!this.maps) return;
    if (!this.view) return;

    let material = this.view.components.material.material;
    for (let map of ["map"].concat(HANDLED_MAPS))
    {
      if (!material[map]) continue;
      material[map].repeat.set(this.data.repeat, this.data.repeat)
      material[map].wrapT = THREE.RepeatWrapping
      material[map].wrapS = THREE.RepeatWrapping
      material[map].needsUpdate = true
      material[map].flipY = !this.data.flipY
    }
    this.view.getObject3D('mesh').rotation.z = - Math.PI / 2 * this.data.rotations
  },
  setLayerMaterial() {
    if (Compositor.component.activeLayer.materialPack === this.data.pack)
    {
      delete Compositor.component.activeLayer.materialPack
    }
    else
    {
      Compositor.component.activeLayer.materialPack = this.data.pack
    }
    Compositor.el.emit('layerupdated', {layer: Compositor.component.activeLayer})
  },
  increaseRepeat() {
    this.data.repeat = THREE.Math.clamp(this.data.repeat + 1, 1, 50)
    this.updateRepeat()
  },
  decreaseRepeat() {
    this.data.repeat = THREE.Math.clamp(this.data.repeat - 1, 1, 50)
    this.updateRepeat()
  },
  rotate() {
    this.data.rotations = this.data.rotations + 1 % 4
    this.updateRepeat()
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

      if (map === 'aoMap') { map = 'ambientOcclusionMap'; }
      attr[map] = img

      if (map === 'metalnessMap')
      {
        attr["metalness"] = 1
      }
    }

    await Promise.all(promises)
    this.view.setAttribute('material', attr)
    this.maps = attr
    delete this.maps.shader
    if ('ambientOcclusionMap' in this.maps)
    {
      this.maps.aoMap = this.maps.ambientOcclusionMap
      delete this.maps.ambientOcclusionMap
    }

    for (let map in this.system.defaultMap)
    {
      if (map in this.maps) continue;
      this.maps[map] = this.system.defaultMap[map]
    }

    this.updateRepeat()
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
    if (!this.el.querySelector('*[click-action="activateMask"]')) return;

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
  applyMask({maskCanvas = undefined, eraseMask = true} = {}) {
    this.isApplying = true
    let tmpCanvas = this.system.tmpCanvas()
    if (!maskCanvas) maskCanvas = Compositor.drawableCanvas
    let tmpCtx = this.system.tmpCtx()

    tmpCtx.globalCompositeOperation = 'copy'
    tmpCtx.drawImage(maskCanvas, 0, 0)

    // Source atop messes something up with the alpha. Need to figure out eventually
    tmpCtx.globalCompositeOperation = this.data.repeat === 1 ? 'source-in' : 'source-atop'

    let startingActiveLayer = Compositor.component.activeLayer
    let activeLayerChanged = false

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
        console.log("adding map layer", map, this)

        layer = new Layer(Compositor.component.width, Compositor.component.height)
        if (map === 'src')
        {
          layer.id = 'material-pack'
          Compositor.component.addLayer(undefined, {layer})
          activeLayerChanged = true
        }
        else
        {
          Compositor.component.addLayer(0, {layer})
          Compositor.component.setLayerBlendMode(layer, map)
          activeLayerChanged = true
        }
      }
      canvas = layer.frame(Compositor.component.currentFrame)

      let repeat = this.data.repeat;
      let repeatXIncrement = Math.round(tmpCanvas.width / repeat);
      let repeatYIncrement = tmpCanvas.height / repeat;

      tmpCtx.save()
      for (let y = 0; y < repeat; ++y)
      {
        for (let x = 0; x < repeat; ++x)
        {
          tmpCtx.save()

          if (this.data.flipY)
          {
            tmpCtx.translate(repeatXIncrement / 2.0, repeatYIncrement / 2.0)
            tmpCtx.scale(1, -1)
            tmpCtx.translate(-repeatXIncrement / 2.0, -repeatYIncrement / 2.0)
          }

          if (this.data.rotations > 0)
          {
            tmpCtx.translate(repeatXIncrement / 2.0, repeatYIncrement / 2.0)
            tmpCtx.rotate(this.data.rotations * - Math.PI / 2)
            tmpCtx.translate(-repeatYIncrement / 2.0, -repeatXIncrement / 2.0)
          }

          if (this.data.rotations % 2 == 0)
          {
            tmpCtx.drawImage(this.maps[map],0, 0, this.maps[map].width, this.maps[map].height,
                                            0, 0, repeatXIncrement, repeatYIncrement,)
          }
          else
          {
            tmpCtx.drawImage(this.maps[map],0, 0, this.maps[map].width, this.maps[map].height,
                                            0, 0, repeatYIncrement, repeatXIncrement,)
          }
          tmpCtx.restore()
          tmpCtx.translate(repeatXIncrement, 0)
        }
        tmpCtx.translate(- repeat * repeatXIncrement, repeatYIncrement)
      }
      tmpCtx.restore()

      if (!this.data[ENABLED_MAP[map]])
      {
        if (repeat > 1)
        {
          tmpCtx.globalCompositeOperation = 'source-in'
        }
        // tmpCtx.globalCompositeOperation = 'color'
        tmpCtx.drawImage(maskCanvas, 0, 0, tmpCanvas.width, tmpCanvas.height,)
        // tmpCtx.globalCompositeOperation = 'source-in'

        if (repeat > 1)
        {
          tmpCtx.globalCompositeOperation = 'source-atop'
        }
      }
      let ctx = canvas.getContext('2d')
      ctx.drawImage(tmpCanvas, 0, 0, canvas.width, canvas.height)
      layer.touch()
      if (canvas.touch) canvas.touch()
      layer.needsUpdate = true
    }

    if (eraseMask)
    {
      maskCanvas.getContext('2d').clearRect(0, 0, maskCanvas.width, maskCanvas.height)
    }

    if (activeLayerChanged)
    {
      Compositor.component.activateLayer(startingActiveLayer)
    }
    this.isApplying = false

    Undo.push(() => {
      if (this.activeMaterialMask) this.activeMaterialMask.deactivateMask()
      this.activeMaterialMask = undefined
    })
  },
})

AFRAME.registerComponent('show-material-pack', {
  schema: {
    pack: {type: 'string'},
  },
  events: {
    object3dset: function () { this.update() }
  },
  init() {},
  update() {
    let mesh = this.el.getObject3D('mesh')
    if (!mesh) return
    let material = this.el.sceneEl.systems['material-pack-system'].previewMaterial(this.data.pack)
    if (!material) return console.warn("No such material", this.data.pack)
    mesh.material = material
  },
  remove() {
    if (this.el.hasAttribute('material'))
    {
      let mesh = this.el.getObject3D('mesh')
      if (!mesh) return
      mesh.material = this.el.components['material'].material
    }
  }
})
