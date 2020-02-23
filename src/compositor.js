import * as NodeTypes from "./layer.js"
const {Layer, CanvasNode, MaterialNode} = NodeTypes
import {Util} from "./util.js"
import {ProjectFile} from "./project-file.js"
import {THREED_MODES} from "./layer-modes.js"
import {Undo} from './undo.js'
import {Environments} from './environments.js'
import {CanvasRecorder} from './canvas-recorder.js'

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
    textureScale: {default: 1},
    frameRate: {default: 10},
    onionSkin: {default: false},
    drawOverlay: {default: true},
    usePreOverlayCanvas: {default: true},
    useNodes: {default: true}
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

    this.preOverlayCanvas = document.createElement("canvas")
    this.preOverlayCanvas.width = width
    this.preOverlayCanvas.height = height

    this.currentFrame = 0
    this.isAnimating = false
    this.lastFrameChangeTime = 0

    this.el.setAttribute('material', {src: compositeCanvas})

    this.layers = [new Layer(this.width, this.height), new Layer(this.width, this.height)]
    this.activeLayer = this.layers[0]
    this.layers[0].shelfMatrix.fromArray([0.23257503824788683, 0, 0, 0, 0, 0.23257503824788683, 0, 0, 0, 0, 0.7752501274929559, 0, -0.1669643613343883, 1.2792903085111105, -0.04627732196156751, 1])
    this.layers[1].shelfMatrix.fromArray([0.1779292490718412, 0, 0, 0, 0, 0.1779292490718412, 0, 0, 0, 0, 0.5930974969061377, 0, -0.15815008613669024, 0.27784067165961246, -0.009772795407444274, 1])

    this.overlays = {}

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

    this.allNodes = []
    this.materialNode = new MaterialNode(this)
    this.materialNode.shelfMatrix.fromArray([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 3.9211894503691473, 1.7114385325515813, -0.20684204251928567, 1])
    let defaultNode = new CanvasNode(this)
    defaultNode.shelfMatrix.fromArray([0.6970027251633882, 0, 0, 0, 0, 0.6970027251633882, 0, 0, 0, 0, 0.6970027251633882, 0, 0.10398909598272707, 1.7751184493294392, -0.17810752996759185, 1])
    defaultNode.connectDestination(this.layers[0])
    defaultNode.connectInput(this.layers[1], {type: "source", index: 0})
    this.materialNode.connectInput(defaultNode, {type: "canvas"})

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

    for (let i = 0; i < layer.frames.length; ++i)
    {
      if (i >= newLayer.frames.length)
      {
        newLayer.insertFrame(i)
      }
      newLayer.frames[i].getContext('2d').drawImage(layer.frames[i], 0, 0)
    }
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
    let ctx = ontoLayer.frame(this.currentFrame).getContext('2d')
    ctx.save()

    ctx.translate(ontoLayer.width / 2, ontoLayer.height / 2)
    ctx.scale(1/ontoLayer.transform.scale.x, 1/ontoLayer.transform.scale.y)
    ctx.translate(-ontoLayer.width / 2, -ontoLayer.height / 2)

    ctx.translate(-ontoLayer.transform.translation.x, -ontoLayer.transform.translation.y)

    fromLayer.draw(ctx, this.currentFrame)
    ctx.restore()
    ontoLayer.needsUpdate = true
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
  deleteNode(node) {
    let nodeIdx = this.allNodes.indexOf(node)
    if (nodeIdx < 0) return

    for (let connection of node.getConnections())
    {
      node.disconnectInput(connection)
      this.el.emit('nodeconnectionschanged', {node})
    }

    for (let otherNode of this.allNodes)
    {
      let connections = otherNode.getConnections()
      for (let connection of connections)
      {
        if (connection.to === node)
        {
          console.log("clearing connection", connection)
          otherNode.disconnectInput(connection)
          this.el.emit('nodeconnectionschanged', {node: otherNode})
        }
      }
    }

    console.log("Deleting node")

    this.allNodes.splice(nodeIdx, 1)
    this.el.emit('nodedeleted', {node})
  },
  drawOverlay(ctx) {
    ctx.save()
    const {width, height} = this

    this.el.components['draw-canvas'].transform = Layer.EmptyTransform()

    let overlayCtx = this.overlayCanvas.getContext('2d')
    overlayCtx.clearRect(0, 0, width, height)

    for (let overlay of Object.values(this.overlays))
    {
      if (!overlay.el.id.endsWith('-hand')) continue
      let raycaster = overlay.el.components.raycaster
      if (!raycaster) continue
      let intersection = raycaster.intersections
                            .filter(i => i.object.el === this.el || (i.object.el.hasAttribute('forward-draw')))
                            .sort(i => - i.distance)
                            [0]


      if (!intersection) continue
      this.el.components['draw-canvas'].drawOutlineUV(overlayCtx, overlay.uv, {canvas: this.overlayCanvas, rotation: overlay.rotation})
    }

    ctx.globalCompositeOperation = 'difference'
    ctx.drawImage(this.overlayCanvas, 0, 0)

    if (this.data.onionSkin && this.activeLayer.frames.length > 1)
    {
      const onionSkins = [[1, "#4a75e0"], [-1, "#e04a6d"]]
      for (let [frameOffset, color] of onionSkins)
      {
        overlayCtx.clearRect(0, 0, width, height)
        overlayCtx.globalCompositeOperation = 'copy'
        this.activeLayer.draw(overlayCtx, this.activeLayer.frameIdx(this.currentFrame + frameOffset))
        overlayCtx.globalCompositeOperation = 'source-in'
        overlayCtx.fillStyle = color
        overlayCtx.fillRect(0, 0, width, height)

        ctx.globalCompositeOperation = 'source-over'
        ctx.globalAlpha = 0.5
        ctx.drawImage(this.overlayCanvas, 0, 0)
      }
    }
    ctx.restore()
  },
  playPauseAnimation() {
    this.isPlayingAnimation = !this.isPlayingAnimation
  },
  jumpToFrame(frame) {
    this.currentFrame = frame
    if (this.activeLayer.frames.length > 1)
    {
      this.el.setAttribute('draw-canvas', {canvas: this.activeLayer.frame(this.currentFrame)})
    }
    this.el.emit('framechanged', {frame: this.currentFrame})
  },
  nextFrame() {
    this.isPlayingAnimation = false
    this.jumpToFrame(++this.currentFrame)
  },
  previousFrame() {
    this.isPlayingAnimation = false
    this.jumpToFrame(--this.currentFrame)
  },
  addFrameAfter() {
    this.currentFrame = this.activeLayer.frameIdx(this.currentFrame)
    this.activeLayer.insertFrame(this.currentFrame)
    this.nextFrame()
    let frameToUndo = this.currentFrame
    Undo.push(() => this.deleteFrame(frameToUndo))
    this.el.emit('layerupdated', {layer: this.activeLayer})
  },
  addFrameBefore() {
    this.currentFrame = this.activeLayer.frameIdx(this.currentFrame - 1)
    this.activeLayer.insertFrame(this.activeLayer.frameIdx(this.currentFrame))
    this.nextFrame()
    let frameToUndo = this.currentFrame
    Undo.push(() => this.deleteFrame(frameToUndo))
    console.log(this.activeLayer.frameIdx(this.currentFrame), this.activeLayer.frames)
    this.el.emit('layerupdated', {layer: this.activeLayer})
  },
  duplicateFrameAfter() {
    let sourceCanvas = this.activeLayer.frame(this.currentFrame)
    this.addFrameAfter()
    let destinationCanvas = this.activeLayer.frame(this.currentFrame)
    let ctx = destinationCanvas.getContext('2d')
    ctx.globalCompositeOperation = 'copy'
    ctx.drawImage(sourceCanvas, 0, 0)
    ctx.globalCompositeOperation = 'source-over'
  },
  duplicateFrameBefore() {
    let sourceCanvas = this.activeLayer.frame(this.currentFrame)
    this.addFrameBefore()
    let destinationCanvas = this.activeLayer.frame(this.currentFrame)
    let ctx = destinationCanvas.getContext('2d')
    ctx.globalCompositeOperation = 'copy'
    ctx.drawImage(sourceCanvas, 0, 0)
    ctx.globalCompositeOperation = 'source-over'
  },
  deleteFrame(frame) {
    if (typeof frame === 'undefined') frame = this.currentFrame
    if (this.activeLayer.frames.length > 1)
    {
      this.currentFrame = this.activeLayer.frameIdx(frame)
      this.activeLayer.deleteFrame(this.currentFrame)
      this.jumpToFrame(this.activeLayer.frameIdx(this.currentFrame))
      this.el.emit('layerupdated', {layer: this.activeLayer})
    }
  },
  toggleOnionSkin() {
    this.data.onionSkin = !this.data.onionSkin
  },
  tick(t, dt) {
    if (dt > 25 && (t - this.drawnT) < 1000) {
      return
    }

    if (this.isPlayingAnimation)
    {
      if (!this.playingStartTime)
      {
        this.playingStartTime = t
        this.startingFrame = this.currentFrame
      }

      this.jumpToFrame(Math.round((t - this.playingStartTime) * this.data.frameRate / 1000.0) + this.startingFrame)
    }
    else
    {
      delete this.playingStartTime
    }

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

    if (this.data.useNodes)
    {
      this.drawNodes()
    }
    else
    {
      this.drawLayers()
    }
  },
  drawNodes() {
    let fakeLayers = []
    for (let mode in this.materialNode.inputs)
    {
      let input = this.materialNode.inputs[mode]
      if (input.updateCanvas) input.updateCanvas(this.currentFrame)
      fakeLayers.push({
        mode,
        draw: input.draw.bind(input),
        opacity: input.opacity,
        transform: input.transform,
        needsUpdate: true,
        visible: true,
        canvas: input.canvas,
        frames: input.frames || [],
        frame: input.frame || (() => input.canvas)
      })
    }
    this.drawLayers(fakeLayers)
  },
  drawLayers(layers) {
      if (typeof layers === 'undefined') layers = this.layers
      let ctx = this.compositeCanvas.getContext('2d')
      // ctx.fillStyle = "#FFFFFF"
      ctx.clearRect(0,0, this.width, this.height)

      const width = this.width
      const height = this.height

      let material = this.el.getObject3D('mesh').material

      let modesUsed = new Set()

      for (let layer of layers) {
        let neededUpdate = layer.needsUpdate
        delete layer.needsUpdate
        if (!layer.visible) continue
        if (THREED_MODES.indexOf(layer.mode) < 0)
        {
          layer.draw(ctx, this.currentFrame)
          continue
        }
        if (material.type !== "MeshStandardMaterial") continue

        if (modesUsed.has(layer.mode)) continue;

        let layerCanvas = layer.canvas

        if (layer.frames.length > 1)
        {
          layerCanvas = layer.frame(this.currentFrame)
        }

        if (!material[layer.mode]) {
          material[layer.mode] = createTexture()
          material.needsUpdate = true
        }

        if (material[layer.mode].image !== layerCanvas)
        {
          material[layer.mode].image = layerCanvas
          material[layer.mode].needsUpdate = true
        }
        else if (layer.active || neededUpdate)
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
            Environments.installSkybox(layerCanvas, layer.opacity)
            material.envMap.mapping = THREE.SphericalReflectionMapping
            break
        }

        modesUsed.add(layer.mode)
      }

      if (this.data.usePreOverlayCanvas)
      {
        let preOverlayCtx = this.preOverlayCanvas.getContext('2d')
        preOverlayCtx.globalCompositeOperation = 'copy'
        preOverlayCtx.drawImage(this.compositeCanvas, 0, 0)
      }

      this.drawOverlay(ctx)

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

    for (let layer of this.layers.slice()) {
      console.log("Deleting", layer)
      this.deleteLayer(layer)
      await delay()
    }

    for (let node of this.allNodes.slice()) {
      console.log("Deleting", node)
      this.deleteNode(node)
      await delay()
    }

    this.data.frameRate = obj.frameRate
    this.el.setAttribute('compositor', {frameRate: obj.frameRate})

    this.resize(obj.width, obj.height)

    let layersById = {}

    for (let i = 0; i < obj.layers.length; ++i)
    {
      let layerObj = obj.layers[i]

      let layer = new Layer(layerObj.width, layerObj.height)
      let canvas = layer.canvas
      Object.assign(layer, layerObj)
      layer.canvas = canvas
      layer.active = false
      layer.frames = [canvas]
      layer.shelfMatrix = new THREE.Matrix4().fromArray(layerObj.shelfMatrix.elements)
      layersById[layer.id] = layer

      for (let j = 0; j < obj.canvases[i].length; ++j)
      {
        let img = new Image
        let canvasData = obj.canvases[i][j]
        img.src = canvasData
        console.log("Loaded Layer", layer, j, obj.canvases[i].length)
        await delay()
        while (j >= layer.frames.length)
        {
          layer.insertFrame(layer.frames.length)
        }
        layer.frames[j].getContext('2d').drawImage(img, 0, 0)
      }

      await delay()

      this.layers.push(layer)
      this.el.emit('layeradded', {layer})
      await delay()
      this.el.emit('layerupdated', {layer})
      await delay()
    }

    this.deleteLayer(this.layers[0])

    this.activateLayer(this.layers.find(l => l.active))

    let nodesById = {}

    for (let nodeObj of obj.allNodes)
    {
      let node = new NodeTypes[nodeObj.type](this)
      Object.assign(node, nodeObj)

      nodesById[node.id] = node

      node.shelfMatrix = new THREE.Matrix4().fromArray(nodeObj.shelfMatrix.elements)

      if (nodeObj.type == 'MaterialNode')
      {
        this.materialNode = node
      }

      this.el.emit('nodeadded', {node})
      await delay()
    }

    for (let nodeObj of obj.allNodes)
    {
      let node = nodesById[nodeObj.id]

      for (let connection of nodeObj.connections)
      {
        if (!connection || !connection.to) continue
        let toNode = nodesById[connection.to] || layersById[connection.to]
        node.connectInput(toNode, connection)
      }

      this.el.emit('nodeconnectionschanged', {node})
      await delay()
    }

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

    this.preOverlayCanvas.width = this.width
    this.preOverlayCanvas.height = this.height

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

    for (let node of this.allNodes)
    {
      node.resize(width, height)
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

    this.el.emit('resized', {width, height})
  }
})
