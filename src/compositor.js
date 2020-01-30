import {Layer} from "./layer.js"
import {Util} from "./util.js"
import {ProjectFile} from "./project-file.js"
import {THREED_MODES} from "./layer-modes.js"
import {Undo} from './undo.js'
import {Environments} from './environments.js'

function createTexture() {
  let t = new THREE.Texture()
  t.generateMipmaps = false
  t.minFilter = THREE.LinearFilter
  return t
}

AFRAME.registerComponent('compositor', {
  schema: {
    width: {default: 1024},
    height: {default: 512},
    baseWidth: {default: 1024},
    geometryWidth: {default: 80},
    throttle: {default: 10},
    textureScale: {default: 1}
  },

  init() {
    let {width, height} = this.data
    this.width = width
    this.height = height

    let compositeCanvas = document.createElement("canvas")
    compositeCanvas.width = width
    compositeCanvas.height = height
    document.body.append(compositeCanvas)
    this.compositeCanvas = compositeCanvas

    this.el.setAttribute('material', {src: compositeCanvas})

    this.layers = [new Layer(this.width, this.height), new Layer(this.width, this.height)]
    this.activeLayer = this.layers[0]

    let bgCtx = this.activeLayer.canvas.getContext('2d')
    bgCtx.fillStyle = "#FFF"
    bgCtx.fillRect(0,0,this.width,this.height)

    this.activateLayer(this.layers[1])

    let overlayCanvas = document.createElement("canvas")
    overlayCanvas.width = this.width
    overlayCanvas.height = this.height
    document.body.append(overlayCanvas)
    this.overlayCanvas = overlayCanvas;

    this.el.setAttribute("draw-canvas", {canvas: this.layers[0].canvas, compositor: this})
    this.activateLayer(this.activeLayer)

    this.redirector = this.el.querySelector('#move-layer-redirection')

    this.tick = AFRAME.utils.throttleTick(this.tick, this.data.throttle, this)
  },

  update() {
    if (this.data.textureScale != 1)
    {
      this.textureCanvas = this.textureCanvas || document.createElement("canvas")
      this.textureCanvas.width = this.width * this.data.textureScale
      this.textureCanvas.height = this.height * this.data.textureScale
    }
  },

  addLayer(position, {layer} = {}) {
    if (typeof(layer) === 'undefined') layer = new Layer(this.width, this.height)
    this.layers.splice(position + 1, 0, layer)
    this.el.emit('layeradded', {layer})
    this.activateLayer(layer)
    Undo.push(e=> this.deleteLayer(layer))
  },

  duplicateLayer(layer) {
    let newLayer = new Layer(layer.width, layer.height)
    newLayer.transform = JSON.parse(JSON.stringify(layer.transform))
    newLayer.mode = layer.mode
    newLayer.canvas.getContext('2d').drawImage(layer.canvas, 0, 0)
    let position = this.layers.indexOf(layer)
    this.layers.splice(position + 1, 0, newLayer)
    this.el.emit('layeradded', {layer: newLayer})
    this.activateLayer(layer)
    Undo.push(e=> this.deleteLayer(layer))
  },

  activateLayer(layer) {
    //if (layer === this.activeLayer) return
    this.ungrabLayer(layer)
    this.activeLayer.active = false
    let oldLayer = this.activeLayer
    this.el.setAttribute('draw-canvas', {canvas: layer.canvas})
    this.el.components['draw-canvas'].transform = layer.transform
    layer.active = true
    this.activeLayer = layer

    if (this.layers.indexOf(oldLayer) >= 0)
    {
      this.el.emit('layerupdated', {layer: oldLayer})
    }

    if (this.layers.indexOf(layer) >= 0)
    {
      this.el.emit('layerupdated', {layer})
    }
  },

  nextLayer() {
    let idx = this.layers.indexOf(this.activeLayer)
    this.activateLayer(this.layers[(idx + 1) % this.layers.length])
  },

  prevLayer() {
    let idx = this.layers.indexOf(this.activeLayer) - 1
    if (idx < 0) idx += this.layers.length
    this.activateLayer(this.layers[idx])
  },
  swapLayers(layer1, layer2) {
    let idx1 = this.layers.indexOf(layer1)
    let idx2 = this.layers.indexOf(layer2)
    this.layers[idx1] = layer2
    this.layers[idx2] = layer1
    this.el.emit('layersmoved', {layers: [layer1,layer2]})
    Undo.push(e=> this.swapLayers(layer1, layer2))
  },
  mergeLayers(fromLayer, ontoLayer) {
    Undo.pushCanvas(ontoLayer.canvas)
    let ctx = ontoLayer.canvas.getContext('2d')
    ctx.save()


    ctx.translate(ontoLayer.width / 2, ontoLayer.height / 2)
    ctx.scale(1/ontoLayer.transform.scale.x, 1/ontoLayer.transform.scale.y)
    ctx.translate(-ontoLayer.width / 2, -ontoLayer.height / 2)

    ctx.translate(-ontoLayer.transform.translation.x, -ontoLayer.transform.translation.y)

    fromLayer.draw(ctx)
    ctx.restore()

  },
  deleteLayer(layer) {
    let idx = this.layers.indexOf(layer)

    Undo.push(() => this.addLayer(idx, {layer}))

    console.log("Deleting layer", layer.id, idx)
    if (idx < 0) throw new Error("Cannot find layer to delete", layer)

    if (this.grabbedLayer == layer)
    {
      this.ungrabLayer(layer)
    }

    this.layers.splice(idx, 1)
    if (this.layers.length == 0)
    {
      this.addLayer(0)
    }
    if (layer.active && this.layers.length > 0)
    {
      this.activateLayer(this.layers[idx % this.layers.length])
    }

    this.el.emit('layerdeleted', {layer})
  },
  setLayerBlendMode(layer,mode) {
    let oldMode = layer.mode
    Undo.push(() => this.setLayerBlendMode(layer, oldMode))
    layer.mode = mode
    this.el.emit('layerupdated', {layer})
  },
  grabLayer(layer) {
    if (this.grabbedLayer == layer)
    {
      this.ungrabLayer(layer)
      return
    }

    if (this.grabbedLayer)
    {
      this.grabbedLayer.grabbed = false
      this.el.emit('layerupdated', {layer: this.grabbedLayer})
    }

    this.redirector.object3D.position.set(
      layer.transform.translation.x / this.width * this.el.components.geometry.data.width,
      -layer.transform.translation.y / this.height * this.el.components.geometry.data.height,
      0)
    this.redirector.object3D.scale.set(layer.transform.scale.x, layer.transform.scale.y, 1)
    this.redirector.object3D.rotation.z = layer.transform.rotation
    this.el['redirect-grab'] = this.redirector
    layer.grabbed = true
    this.grabbedLayer = layer
    this.el.emit('layerupdated', {layer})
  },
  ungrabLayer() {
    if (!this.grabbedLayer) return
    let layer = this.grabbedLayer
    this.el['redirect-grab'] = undefined
    layer.grabbed = false
    this.grabbedLayer = undefined
    this.el.emit('layerupdated', {layer})
  },
  drawOverlay(ctx) {
    ctx.save()
    const {width, height} = this

    this.el.components['draw-canvas'].transform = Layer.EmptyTransform()

    let overlayCtx = this.overlayCanvas.getContext('2d')
    overlayCtx.clearRect(0, 0, width, height)

    for (let hand of ['right-hand', 'left-hand'])
    {
      let raycaster = document.getElementById(hand).components.raycaster
      let intersection = raycaster.intersections
                            .filter(i => i.object.el === this.el || (i.object.el.hasAttribute('forward-draw')))
                            .sort(i => - i.distance)
                            [0]


      if (!intersection) continue

      let rotationEuler = this.rotationEuler || new THREE.Euler()
      this.rotationEuler = rotationEuler
      rotationEuler.copy(document.getElementById(hand).object3D.rotation)
      rotationEuler.reorder("ZYX")
      let rotation = - rotationEuler.z

      this.el.components['draw-canvas'].drawOutlineUV(overlayCtx, intersection.uv, {canvas: this.overlayCanvas, rotation: rotation})
    }

    ctx.globalCompositeOperation = 'difference'
    ctx.drawImage(this.overlayCanvas, 0, 0)
    ctx.restore()
  },
  tick(t, dt) {
    if (dt > 25 && (t - this.drawnT) < 1000) {
      return
    }

    this.drawnT = t

    if (this.el['redirect-grab'])
    {
      let layer = this.grabbedLayer
      layer.transform.translation.x = this.redirector.object3D.position.x / this.el.components.geometry.data.width * this.width
      layer.transform.translation.y = -this.redirector.object3D.position.y / this.el.components.geometry.data.height * this.height
      layer.transform.scale.x = this.redirector.object3D.scale.x
      layer.transform.scale.y = this.redirector.object3D.scale.y

      if (this.redirector.grabbingManipulator)
      {
        //layer.transform.rotation = this.redirector.grabbingManipulator.el.object3D.rotation.z
      }
    }

    let ctx = this.compositeCanvas.getContext('2d')
    // ctx.fillStyle = "#FFFFFF"
    ctx.clearRect(0,0, this.width, this.height)

    const width = this.width
    const height = this.height

    let material = this.el.getObject3D('mesh').material

    let modesUsed = new Set()

    for (let layer of this.layers) {
      if (!layer.visible) continue
      if (THREED_MODES.indexOf(layer.mode) < 0)
      {
        layer.draw(ctx)
        continue
      }
      if (material.type !== "MeshStandardMaterial") continue

      if (!material[layer.mode]) {
        material[layer.mode] = createTexture()
        material.needsUpdate = true
      }

      if (material[layer.mode].image !== layer.canvas)
      {
        material[layer.mode].image = layer.canvas
        material[layer.mode].needsUpdate = true
        console.log("Needs update", layer)
      }
      else if (layer.active)
      {
        material[layer.mode].needsUpdate = true
      }

      switch (layer.mode)
      {
        case "displacementMap":
          material.displacementBias = 0
          material.displacementScale = layer.opacity
        break
        case "bumpMap":
          material.bumpScale = Math.pow(layer.opacity, 2.2)
        break
        case "emissiveMap":
          material.emissive.r = 1
          material.emissive.g = 1
          material.emissive.b = 1
          material.emissiveIntensity = layer.opacity
          break
        case "normalMap":
          material.normalScale = new THREE.Vector2(layer.opacity, layer.opacity)
          break
        case "metalnessMap":
          material.metalness = layer.opacity
          break
        case "roughnessMap":
          material.roughness = layer.opacity
          break
        case "envMap":
          Environments.installSkybox(layer.canvas, layer.opacity)
          material.envMap.mapping = THREE.SphericalReflectionMapping
          break
      }


      modesUsed.add(layer.mode)
    }

    if (!Array.from(document.querySelectorAll('*[hand-draw-tool]')).some(e => e.is('sampling')))
    {
      this.drawOverlay(ctx)
    }

    this.el.components['draw-canvas'].transform = this.activeLayer.transform



    if (this.data.textureScale != 1)
    {
      let textureCtx = this.textureCanvas.getContext('2d')
      textureCtx.drawImage(this.compositeCanvas, 0, 0, this.textureCanvas.width, this.textureCanvas.height)
      material.map.image = this.textureCanvas
    }
    else
    {
      material.map.image = this.compositeCanvas
    }
    material.map.needsUpdate = true

    if (material.type !== "MeshStandardMaterial") return
    for (let mode of THREED_MODES)
    {
      if  (material[mode] && !modesUsed.has(mode))
      {
        switch (mode)
        {
          case "emissiveMap":
            material.emissiveIntensity = 0
          break
        }
        material[mode] = null
        material.needsUpdate = true
      }
    }
  },
  // clear() {
  //   this.el.emit
  // },
  async load(obj) {
    let delay = () => new Promise(r => setTimeout(r, 10))

    for (let layer of this.layers) {
      console.log("Deleting", layer)
      this.deleteLayer(layer)
      await delay()
    }

    this.resize(obj.width, obj.height)

    for (let i = 0; i < obj.layers.length; ++i)
    {
      let layerObj = obj.layers[i]
      let canvasData = obj.canvases[i]

      let layer = new Layer(layerObj.width, layerObj.height)
      let canvas = layer.canvas
      Object.assign(layer, layerObj)
      layer.canvas = canvas
      layer.active = false

      let img = new Image
      img.src = canvasData
      await delay()
      console.log("Loaded Layer", layer)
      await delay()
      layer.canvas.getContext('2d').drawImage(img, 0, 0)
      await delay()

      this.layers.push(layer)
      this.el.emit('layeradded', {layer})
      await delay()
      this.el.emit('layerupdated', {layer})
      await delay()
    }

    this.deleteLayer(this.layers[0])

    this.activateLayer(this.layers.find(l => l.active))
    console.log("Fully loaded")
  },
  resize(newWidth, newHeight, {resample = false} = {})
  {
    let oldWidth = this.width
    let oldHeight = this.height

    let {width, height} = Util.validateSize({width: newWidth, height: newHeight})

    console.log("Resizing from", oldWidth, oldHeight, "to", width, height)

    this.width = width
    this.height = height

    this.compositeCanvas.width = width
    this.compositeCanvas.height = height

    this.overlayCanvas.width = this.width
    this.overlayCanvas.height = this.height

    if (resample)
    {
      var resampleCanvas = document.createElement('canvas')
      resampleCanvas.width = width
      resampleCanvas.height = height
      var resampleCtx = resampleCanvas.getContext('2d')
      resampleCtx.globalCompositeOperation = 'copy'
    }

    for (let layer of this.layers)
    {
      if (resample)
      {
        resampleCtx.drawImage(layer.canvas, 0, 0, width, height)
      }

      layer.resize(width, height)

      if (resample)
      {
        layer.canvas.getContext('2d').drawImage(resampleCanvas, 0, 0, width, height)
      }
    }

    if (this.el.components['geometry'])
    {
      let gWidth = this.width / this.data.baseWidth * this.data.geometryWidth
      let gHeight = this.height / this.data.baseWidth * this.data.geometryWidth
      this.el.setAttribute('geometry', {primitive: 'plane', width: gWidth, height: gHeight})
    }

    for (let layer of this.layers)
    {
      this.el.emit('layerupdated', {layer})
    }
  }
})
