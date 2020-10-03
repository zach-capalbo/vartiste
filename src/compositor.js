import * as NodeTypes from "./layer.js"
import * as AINodes from './ai-nodes.js'
const {Layer, CanvasNode, MaterialNode} = NodeTypes
Object.assign(NodeTypes, AINodes)
import {Util} from "./util.js"
import {ProjectFile} from "./project-file.js"
import {THREED_MODES} from "./layer-modes.js"
import {Undo} from './undo.js'
import {CanvasRecorder} from './canvas-recorder.js'
import {Pool} from './pool.js'

function createTexture() {
  let t = new THREE.Texture()
  t.generateMipmaps = false
  t.minFilter = THREE.LinearFilter
  // t.wrapS = THREE.RepeatWrapping
  // t.wrapT = THREE.RepeatWrapping
  return t
}

AFRAME.registerComponent('compositor', {
  dependencies: ['material', 'geometry'],
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
    useNodes: {default: false},
    flipY: {default: false},
    skipDrawing: {default: false},
    wrapTexture: {default: false},
  },

  init() {
    let {width, height} = this.data
    this.width = width
    this.height = height

    Pool.init(this)

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
    this.el.getObject3D('mesh').material.map.flipY = this.data.flipY
    this.el.getObject3D('mesh').material.map.anisotropy = 16

    // Appear in main camera and canvas-only camera
    this.el.getObject3D('mesh').layers.mask = 3

    this.flipUVY()

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
    this.redirector.addEventListener('stateremoved', e => {
      if (e.detail === 'grabbed') {
        this.updateRedirectorTransformation()
      }
    })

    this.tick = AFRAME.utils.throttleTick(this.tick, this.data.throttle, this)

    this.allNodes = []
    this.materialNode = new MaterialNode(this)
    this.materialNode.shelfMatrix.fromArray([0.4163862789381145, 0, 0, 0, 0, 0.4163862789381145, 0, 0, 0, 0, 0.4163862789381145, 0, 2.741181743466289, 0.9692342189892807, 0.2527472733592222, 1])
    this.materialNode.shelfMatrix
    let defaultNode = new CanvasNode(this)
    defaultNode.shelfMatrix.fromArray([0.22465332680396122, 0, 0, 0, 0, 0.22465332680396122, 0, 0, 0, 0, 0.22465332680396122, 0, 1.340575716244399, 0.6194291453403057, 0.20383553138687294, 1])
    defaultNode.connectDestination(this.layers[0])
    defaultNode.connectInput(this.layers[1], {type: "source", index: 0})
    this.materialNode.connectInput(defaultNode, {type: "canvas"})

    this.slowCount = 0

  },

  update(oldData) {
    if (this.data.textureScale != 1)
    {
      this.textureCanvas = this.textureCanvas || document.createElement("canvas")
      this.textureCanvas.width = this.width * this.data.textureScale
      this.textureCanvas.height = this.height * this.data.textureScale
    }
    if (this.data.useNodes !== oldData.useNodes)
    {
      for (let node of this.allNodes)
      {
        node.touch()
      }
      for (let layer of this.layers)
      {
        layer.touch()
      }
    }
    if (this.data.shader !== oldData.shader)
    {
      this.materialNode.touch()
    }
  },

  addLayer(position, {layer} = {}) {
    if (typeof(layer) === 'undefined') layer = new Layer(this.width, this.height)
    if (typeof(position) === 'undefined') position = this.layers.length - 1
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
    this.activateLayer(newLayer)
    Undo.push(e=> this.deleteLayer(newLayer))
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
    ontoLayer.touch()
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
    Undo.collect(() => {
      Undo.push(() => this.setLayerBlendMode(layer, oldMode))
      layer.mode = mode

      if (mode === 'normalMap')
      {
        Undo.pushCanvas(layer.canvas)
        let ctx = layer.canvas.getContext('2d')
        ctx.globalCompositeOperation = 'destination-over'
        ctx.fillStyle = 'rgb(128, 128, 255)'
        ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height)
        ctx.globalCompositeOperation = 'source-over'
      }

      layer.touch()
      this.el.emit('layerupdated', {layer})
    })
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

    this.redirector.setAttribute('visible', true)

    this.el['redirect-grab'] = this.redirector
    layer.grabbed = true
    this.grabbedLayer = layer
    this.updateRedirectorTransformation()
    this.el.emit('layerupdated', {layer})
  },
  ungrabLayer() {
    if (!this.grabbedLayer) return
    this.redirector.setAttribute('visible', false)
    let layer = this.grabbedLayer
    this.el['redirect-grab'] = undefined
    layer.grabbed = false
    this.grabbedLayer = undefined
    this.el.emit('layerupdated', {layer})
  },
  updateRedirectorTransformation() {
    let layer = this.grabbedLayer
    this.redirector.object3D.position.set(
      layer.transform.translation.x / this.width * this.el.components.geometry.data.width,
      -layer.transform.translation.y / this.height * this.el.components.geometry.data.height,
      0)
    this.redirector.object3D.scale.set(layer.transform.scale.x, layer.transform.scale.y, 1)
    this.redirector.object3D.rotation.set(0, 0, -layer.transform.rotation)
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
  flipUVY(force) {
    if (!force)
    {
      let atZero = (this.el.getObject3D('mesh').geometry.attributes.uv.array[1] == 0)
      let atOne = (this.el.getObject3D('mesh').geometry.attributes.uv.array[1] == 1)
      if (!this.data.flipY && atZero) return
      if (this.data.flipY && !atZero) return
    }
    console.log("Flipping UV Y Coords")
    let o = this.el.getObject3D('mesh')
    if (o.geometry && o.geometry.attributes.uv)
    {
      let array = o.geometry.attributes.uv.array
      for (let i = 0; i < o.geometry.attributes.uv.count * 2; i+= 2)
      {
        array[i + 1] = 1 - array[i + 1]
      }
      o.geometry.attributes.uv.needsUpdate = true
    }
  },
  drawOverlay(ctx) {
    if (!this.data.drawOverlay) return
    ctx.save()
    const {width, height} = this

    this.el.components['draw-canvas'].transform = Layer.EmptyTransform()

    let overlayCtx = this.overlayCanvas.getContext('2d')

    if (this.data.onionSkin && this.activeLayer.frames.length > 1)
    {
      const onionSkins = [
        [2, "#4a75e0"],
        [1, "#4a75e0"],
        [-1, "#e04a6d"],
        [-2, "#e04a6d"]
      ]
      for (let [frameOffset, color] of onionSkins)
      {
        if (this.activeLayer.frames.length <= Math.abs(frameOffset)) continue;
        overlayCtx.clearRect(0, 0, width, height)
        overlayCtx.globalCompositeOperation = 'copy'
        this.activeLayer.draw(overlayCtx, this.activeLayer.frameIdx(this.currentFrame + frameOffset))
        overlayCtx.globalCompositeOperation = 'source-in'
        overlayCtx.fillStyle = color
        overlayCtx.fillRect(0, 0, width, height)

        ctx.globalCompositeOperation = 'source-over'
        ctx.globalAlpha = Math.pow(0.5, Math.abs(frameOffset))
        ctx.drawImage(this.overlayCanvas, 0, 0)
      }
    }

    overlayCtx.clearRect(0, 0, width, height)
    overlayCtx.globalCompositeOperation = 'source-over'

    let overlayObjs = Object.values(this.overlays)


    let {brush} = overlayObjs.find(o => o.brush.solo) || this.el.sceneEl.systems['paint-system']

    if (brush.solo && !brush.direct)
    {
      this.el.components['draw-canvas'].drawOutlineUV(overlayCtx, {x: 0, y: 0}, {canvas: this.overlayCanvas})
    }

    if (!brush.solo)
    {
      for (let overlay of overlayObjs)
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
    }

    ctx.globalCompositeOperation = 'difference'
    ctx.globalAlpha = 1.0
    ctx.drawImage(this.overlayCanvas, 0, 0)

    if (brush.solo && brush.direct)
    {
      ctx.globalCompositeOperation = 'source-over'
      overlayCtx.clearRect(0,0, width, height)
      overlayCtx.globalCompositeOperation = 'copy'
      this.el.components['draw-canvas'].drawOutlineUV(overlayCtx, {x: 0, y: 0}, {canvas: this.overlayCanvas, brush})
      ctx.drawImage(this.overlayCanvas, 0, 0)
    }

    ctx.restore()
  },
  playPauseAnimation() {
    this.isPlayingAnimation = !this.isPlayingAnimation
  },
  jumpToFrame(frame, {force = false, animate = false} = {}) {
    this.currentFrame = frame
    if (this.activeLayer.frames.length > 1 || force)
    {
      this.el.setAttribute('draw-canvas', {canvas: this.activeLayer.frame(this.currentFrame)})
    }

    if (!animate)
    {
      delete this.playingStartTime
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
      this.jumpToFrame(this.activeLayer.frameIdx(this.currentFrame), {force: true})
      this.el.emit('layerupdated', {layer: this.activeLayer})
    }
  },
  toggleOnionSkin() {
    this.data.onionSkin = !this.data.onionSkin
  },
  tick(t, dt) {
    if (dt > 25 && (t - this.drawnT) < 1000) {
      this.slowCount = Math.min(this.slowCount + 1, 20)
      return
    }

    if (t - this.drawnT < 300)
    {
      this.slowCount = Math.max(this.slowCount - 1, 0)
    }

    if (this.isPlayingAnimation)
    {
      if (!this.playingStartTime)
      {
        this.playingStartTime = t
        this.startingFrame = this.currentFrame
      }

      this.jumpToFrame(Math.round((t - this.playingStartTime) * this.data.frameRate / 1000.0) + this.startingFrame, {animate: true})
    }
    else
    {
      delete this.playingStartTime
    }

    if (this.el['redirect-grab'] && this.grabbedLayer)
    {
      let layer = this.grabbedLayer
      // layer.transform.translation.x = this.redirector.object3D.position.x / this.el.components.geometry.data.width * this.width
      // layer.transform.translation.y = -this.redirector.object3D.position.y / this.el.components.geometry.data.height * this.height
      // layer.transform.scale.x = this.redirector.object3D.scale.x
      // layer.transform.scale.y = this.redirector.object3D.scale.y
      //
      // layer.transform.rotation = this.redirector.object3D.rotation.y
      //this.redirector.object3D.position.z = 0

      let projection = this.pool('projection', THREE.Vector3)
      let diff = this.pool('diff', THREE.Vector3)
      let normal = this.pool('normal', THREE.Vector3)
      let quat = this.pool('quat', THREE.Quaternion)
      let unZRotation = this.pool('unZ', THREE.Euler)
      unZRotation.copy(this.redirector.object3D.rotation)
      unZRotation.z = 0
      quat.setFromEuler(unZRotation)
      normal.set(0, 0, -1)

      diff.subVectors(this.redirector.object3D.position, this.el.object3D.position)
      let dot = diff.dot(normal)
      normal.multiplyScalar(dot)
      projection.copy(this.redirector.object3D.position)
      projection.sub(normal)

      layer.transform.translation.x = projection.x / this.el.components.geometry.data.width * this.width
      layer.transform.translation.y = -projection.y / this.el.components.geometry.data.height * this.height
      layer.transform.scale.x = this.redirector.object3D.scale.x
      layer.transform.scale.y = this.redirector.object3D.scale.y
      //
      layer.transform.rotation = quat.angleTo(this.redirector.object3D.quaternion)
      // console.log("Rot", layer.transform.rotation)

      let upRot = this.pool('upRot', THREE.Vector3)
      upRot.set(0, 1, 0)
      upRot.applyQuaternion(this.redirector.object3D.quaternion)
      layer.transform.rotation *= upRot.x > 0 ? 1 : -1

      // q_proj = q - dot(q - p, n) * n

      layer.touch()

      this.updateRedirectorTransformation()
    }

    if (this.data.skipDrawing) return

    if (this.data.useNodes)
    {
      this.drawNodes()
    }
    else
    {
      this.drawLayers()
    }

    this.drawnT = t
  },
  quickDraw() {
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
    let outputNode = this.allNodes.find(n => n.solo)

    if (!outputNode) outputNode = this.materialNode

    outputNode.updateCanvas(this.currentFrame)
    for (let mode in outputNode.inputs)
    {
      let input = outputNode.inputs[mode]

      let needsUpdate = input.updateTime > this.drawnT || outputNode.updateTime > this.drawnT

      if (needsUpdate)
      {
        // console.log("Needs Update", mode, needsUpdate, input.updateTime, outputNode.updateTime, this.drawnT,)
      }

      fakeLayers.push({
        mode,
        draw: input.draw.bind(input),
        opacity: input.opacity,
        transform: input.transform,
        needsUpdate: needsUpdate,
        visible: true,
        canvas: input.canvas,
        frames: input.frames || [],
        frame: input.frame || (() => input.canvas)
      })
    }
    this.drawLayers(fakeLayers)

    for (let layer of this.layers)
    {
      layer.updateFrame = layer.frameIdx(this.currentFrame)
    }
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

      let canSetSkybox = this.el.sceneEl.systems['environment-manager'].canInstallSkybox()

      for (let layer of layers) {
        if (!layer.visible) continue

        if (THREED_MODES.indexOf(layer.mode) < 0)
        {
          layer.draw(ctx, this.currentFrame)
          continue
        }
        if (layer.needsUpdate === false) {
          modesUsed.add(layer.mode)
        }
        if (material.type !== "MeshStandardMaterial" && material.type !== "MeshMatcapMaterial") continue

        if (modesUsed.has(layer.mode)) continue;

        if (layer.mode === 'envMap' && !canSetSkybox) continue

        let layerCanvas = layer.canvas

        if (layer.frames.length > 1)
        {
          layerCanvas = layer.frame(this.currentFrame)
        }

        if (!material[layer.mode]) {
          material[layer.mode] = createTexture()
          material.needsUpdate = true
        }

        if (material[layer.mode].flipY != this.data.flipY) {
          material[layer.mode].flipY = this.data.flipY
        }

        material[layer.mode].wrapS = this.data.wrapTexture ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping
        material[layer.mode].wrapT = this.data.wrapTexture ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping

        if (material[layer.mode].image !== layerCanvas)
        {
          material[layer.mode].image = layerCanvas
          material[layer.mode].needsUpdate = true
        }
        else if (layer.active || layer.needsUpdate)
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
            this.el.sceneEl.systems['environment-manager'].installSkybox(layerCanvas, layer.opacity)
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
      if (material.map.flipY != this.data.flipY) material.map.flipY = this.data.flipY
      material.map.needsUpdate = true
      material.map.wrapS = this.data.wrapTexture ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping
      material.map.wrapT = this.data.wrapTexture ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping

      if (material.type !== "MeshStandardMaterial") return
      for (let mode of THREED_MODES)
      {
        if (mode == "envMap" && !canSetSkybox) continue
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

    this.data.flipY = false
    this.flipUVY()

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

    this.el.setAttribute('compositor', {frameRate: obj.frameRate, useNodes: obj.useNodes})

    this.resize(obj.width, obj.height)

    if (this.data.flipY != obj.flipY)
    {
      console.log("Need to flipUVs")
      this.data.flipY = obj.flipY
      this.flipUVY()
    }

    let layersById = {}
    let activeLayer

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

      if (layerObj.active)
      {
        activeLayer = layer
      }

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

    this.activateLayer(activeLayer || this.layers[this.layers.length - 1])

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

    if (this.allNodes.indexOf(this.materialNode) < 0)
    {
      this.allNodes.push(this.materialNode)
      this.el.emit('nodeadded', {node: this.materialNode})
    }

    console.log("Fully loaded")
  },
  resize(newWidth, newHeight, {resample = false} = {})
  {
    Undo.clearAndResize(newWidth, newHeight)
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
      node.touch()
    }

    if (this.el.components['geometry'])
    {
      let gWidth = this.width / this.data.baseWidth * this.data.geometryWidth
      let gHeight = this.height / this.data.baseWidth * this.data.geometryWidth
      this.el.setAttribute('geometry', {primitive: 'plane', width: gWidth, height: gHeight})
      this.flipUVY()
    }

    for (let layer of this.layers)
    {
      layer.touch()
      this.el.emit('layerupdated', {layer})
    }

    this.el.emit('resized', {width, height})
  }
})

class CompositorFinder {
  get el() {
    return document.getElementById('canvas-view')
  }

  get component() {
    return this.el.components.compositor
  }

  get data() {
    return this.component.data
  }

  get material() {
    return this.el.getObject3D('mesh').material
  }

  get mesh() {
    let compositionView = document.querySelector('#composition-view')
    if (compositionView.getObject3D('mesh')) return compositionView.getObject3D('mesh').getObjectByProperty("type", "Mesh") || compositionView.getObject3D('mesh').getObjectByProperty("type", "SkinnedMesh") || this.el.getObject3D('mesh')
    return this.el.getObject3D('mesh')
  }

  get meshRoot() {
    return document.getElementById('composition-view').getObject3D('mesh') || document.getElementById('canvas-view').getObject3D('mesh')
  }

  get object3D() {
    let compositionView = document.querySelector('#composition-view')
    if (compositionView.getObject3D('mesh')) return compositionView.object3D
    return this.el.object3D
  }

  get drawableCanvas() {
    return this.component.activeLayer.frame(this.component.currentFrame)
  }
}

window.Compositor = new CompositorFinder()
