const layerShelfHTML = require('./partials/layer-view.html.slm')
const modeSelectionHTML = require('./partials/mode-shelf.html.slm')

const {LAYER_MODES, FX} = require('./layer-modes.js')
const {MaterialNode, CanvasNode, Layer} = require('./layer.js')
const {Util} = require('./util.js')
const {Pool} = require('./pool.js')

AFRAME.registerComponent("layer-shelves", {
  schema: {compositor: {type: 'selector'}},
  init() {
    this.built = false
    this.shelves = {}
    this.compositor = Compositor.component
    this.compositorEvents = Object.getOwnPropertyNames(Object.getPrototypeOf(this)).filter(k => k.startsWith("compositor_")).map(k => k.slice("compositor_".length))
    for (let e of this.compositorEvents)
    {
      this['compositor_' + e] = this['compositor_' + e].bind(this)
    }
    Pool.init(this)
  },
  update(oldData) {
    if (oldData.compositor)
    {
      for (let e of this.compositorEvents)
      {
        oldData.compositor.removeEventListener(e, this['compositor_' + e])
      }
    }

    for (let e of this.compositorEvents)
    {
      this.data.compositor.addEventListener(e, this['compositor_' + e])
    }
  },
  addLayerShelf(layer) {
    let layerIdx = Compositor.component.layers.indexOf(layer)
    console.log("Adding shelf for", layer.id, layerIdx)
    var container = document.createElement('a-entity')
    container.layer = layer

    container.innerHTML = layerShelfHTML
    container.addEventListener('click', (e) => {
      if (!e.target.hasAttribute('click-action')) return

      console.log("Clicked", e.target.getAttribute("click-action"))
      this[e.target.getAttribute("click-action") + 'Layer'](layer, e)
    })
    container.setAttribute('scale', {x: 0.3, y: 0.3, z: 0.3})
    container.querySelector('*[canvas-updater]').setAttribute('layer-preview', AFRAME.utils.styleParser.stringify({compositor: `#${this.data.compositor.id}`, layer: layer.id}))
    container.addEventListener('stateremoved', e => {
      if (e.detail === 'grabbed')
      {
        layer.shelfMatrix.copy(container.object3D.matrix)
      }
    })
    let modePopup = container.querySelector('.mode-popup')
    modePopup.parentNode.addEventListener('click', e => { this.handleModeSelection(layer, modePopup, e) })

    container.addEventListener('bbuttonup', e => this.popoutLayer(layer))

    if (this.compositor.data.useNodes)
    {
      container.querySelector('*[shelf]')['redirect-grab'] = container
      Util.whenLoaded(container, () => {
        container.object3D.matrix.copy(layer.shelfMatrix)
        container.object3D.matrix.decompose(
          container.object3D.position,
          container.object3D.quaternion,
          container.object3D.scale
        )
      })
    }
    else
    {
      container.setAttribute('position', {x: 0, y: layerIdx, z: 0})
      container.querySelector('*[shelf]')['redirect-grab'] = this.el
    }

    if (layer.active) {
      container.querySelector('.active-indicator').setAttribute('visible', "true")
    }

    if (!this.compositor.data.useNodes)
    {
      container.querySelectorAll('*[node-output]').forEach(el => el.setAttribute('visible', false))
    }

    this.shelves[layer.id] = container

    container.addEventListener('loaded', e => this.compositor_layerupdated({detail: {layer}}))

    this.el.prepend(container)
  },
  addNodeShelf(node) {
    console.log("Adding shelf for ", node.id)
    let container = document.createElement('a-entity')
    container.node = node

    container.innerHTML = require(`./partials/${node.constructor.name.toLowerCase()}-view.html.slm`)
    container.classList.add("node-shelf")

    container.addEventListener('click', e => {
      if (!e.target.hasAttribute('click-action')) return

      console.log("Clicked", e.target.getAttribute('click-action'))
      this[e.target.getAttribute('click-action') + 'Node'](node, e)
    })


    let shelfRoot = container.querySelector('*[shelf],.node-root')

    Util.whenLoaded(shelfRoot, () => {
      shelfRoot.object3D.matrix.copy(node.shelfMatrix)
      shelfRoot.object3D.matrix.decompose(
        shelfRoot.object3D.position,
        shelfRoot.object3D.quaternion,
        shelfRoot.object3D.scale,
      )
    })

    shelfRoot.addEventListener('stateremoved', e => {
      if (e.detail === 'grabbed') {
        console.log("Setting node root matrix")
        e.target.object3D.updateMatrix()
        node.shelfMatrix = e.target.object3D.matrix
      }
    })

    container.querySelectorAll(`*[node-input]`).forEach(inputNode => {
      inputNode.addEventListener('snappedtoinput', e => {
        let snappedEl = e.detail.snapped
        while (!(snappedEl.layer || snappedEl.node))
        {
          snappedEl = snappedEl.parentEl
        }
        let connector = snappedEl.layer || snappedEl.node
        node.connectInput(connector, inputNode.getAttribute('node-input'))
      })

      inputNode.addEventListener('unsnapped', e => {
        node.disconnectInput(inputNode.getAttribute('node-input'))
      })
    })

    let canvas = container.querySelector('*[canvas-updater]')
    if (canvas)
    {
      let setCanvasMaterial = () => {
        canvas.setAttribute('material', {src: node.canvas})
      }
      if (canvas.hasLoaded) { setCanvasMaterial() } else {  canvas.addEventListener('loaded', setCanvasMaterial) }
    }

    let opacityPicker = container.querySelector('*[opacity-picker]')

    if (opacityPicker)
    {
      let setupOpacity = () => {
        opacityPicker.components['opacity-picker'].layer = node
        opacityPicker.components['opacity-picker'].adjustIndicator(node.opacity)
      }

      if (opacityPicker.hasLoaded) { setupOpacity() } else { opacityPicker.addEventListener('loaded', setupOpacity)}
    }

    let modeText = container.querySelector('.mode-text')
    if (modeText)
    {
      Util.whenLoaded(modeText, () => modeText.setAttribute('text', {value: `Mode: ${node.mode}`}))
    }
    let modePopup = container.querySelector('.mode-popup')
    if (modePopup)
    {
      modePopup.addEventListener('click', e => { this.handleModeSelection(node, modePopup, e) })
    }

    let fxText = container.querySelector('.fx-text')
    if (fxText)
    {
      Util.whenLoaded(fxText, () => fxText.setAttribute('text', {value: `FX: ${node.shader}`}))
      fxText.addEventListener('click', e => {
        if (!e.target.hasAttribute('node-fx')) return

        node.changeShader(e.target.getAttribute('node-fx'))
        fxText.setAttribute('text', {value: `FX: ${node.shader}`})
        fxText.components['popup-button'].closePopup()
      })
    }

    let nodeName = container.querySelector('.name')
    if (nodeName)
    {
      Util.whenLoaded(nodeName, () => nodeName.setAttribute('text', {value: node.name}))
      nodeName.addEventListener('editfinished', e => {
        node.name = nodeName.getAttribute('text').value
      })
    }

    if (!Compositor.component.data.useNodes)
    {
      container.setAttribute('visible', false)
    }

    this.shelves[node.id] = container

    this.el.append(container)
  },
  shuffle() {
    if (this.compositor.data.useNodes) return
    for (let id in this.shelves)
    {
      let layerIdx = this.compositor.layers.findIndex(l => l.id == id)
      if (layerIdx < 0) continue
      this.shelves[id].setAttribute('position', {y: layerIdx})
    }
  },
  rebuildNodeConnections(node) {
    let shelf = this.shelves[node.id]

    if (shelf.hasLoaded)
    {
      shelf.querySelectorAll('*[node-input]').forEach(input => {
        input.components['node-input'].clearSnapped()
      })
    }

    for (let connectionIt of node.getConnections())
    {
      let connection = connectionIt
      if (!connection || !connection.to) continue
      let outputNodeShelf = this.shelves[connection.to.id]
      if (!outputNodeShelf) continue

      console.log("Rebuilding connection", connection.type, connection.to.id)//, outputNodeShelf)

      Util.whenLoaded([outputNodeShelf, shelf], () => {
        let toNodeInput = Array.from(shelf.querySelectorAll('*[node-input]')).find(el => {
          let input = el.getAttribute('node-input')
          console.log("Checking input", `${input.type}:${input.index}`, `${connection.type}:${connection.index}`)
          return input.type === connection.type && input.index == connection.index
        })
        outputNodeShelf.querySelector('*[node-output]').components['node-output'].formConnectionTo(undefined, toNodeInput)
      })
    }
  },
  rebuildConnections() {
    for (let nodeIt of this.compositor.allNodes)
    {
      this.rebuildNodeConnections(nodeIt)
    }
  },
  tick(t, dt) {
    if (!this.built && this.data.compositor.components.compositor) {
      this.compositor = this.data.compositor.components.compositor

      for (let layerIdx in this.compositor.layers)
      {
        let layer = this.compositor.layers[layerIdx]
        this.addLayerShelf(layer, layerIdx)
      }

      for (let node of this.compositor.allNodes)
      {
        this.addNodeShelf(node)
      }

      this.rebuildConnections()
      this.compositor_componentchanged({detail: {name: "compositor"}})
      this.tick = function() {}
    }
  },
  hideLayer(layer) {
    layer.visible = !layer.visible
    this.compositor.el.emit('layerupdated', {layer})
  },
  editLayer(layer) {
    this.compositor.activateLayer(layer)
  },
  deleteLayer(layer) {
    this.compositor.deleteLayer(layer)
  },
  newLayer(layer) {
    let layerIdx = this.compositor.layers.indexOf(layer)
    this.compositor.addLayer(layerIdx)
    this.shuffle()
  },
  duplicateLayer(layer) {
    this.compositor.duplicateLayer(layer)
    this.shuffle()
  },
  moveUpLayer(layer) {
    let layerIdx = this.compositor.layers.indexOf(layer)
    let nextLayer = this.compositor.layers[(layerIdx + 1) % this.compositor.layers.length]
    this.compositor.swapLayers(layer, nextLayer)
  },
  moveDownLayer(layer) {
    let layerIdx = this.compositor.layers.indexOf(layer)
    let nextLayerIdx = layerIdx - 1
    if (nextLayerIdx < 0) nextLayerIdx += this.compositor.layers.length
    this.compositor.swapLayers(layer, this.compositor.layers[nextLayerIdx])
  },
  mergeDownLayer(layer) {
    let layerIdx = this.compositor.layers.indexOf(layer)
    let nextLayerIdx = layerIdx - 1
    if (nextLayerIdx < 0) nextLayerIdx += this.compositor.layers.length
    this.compositor.mergeLayers(layer, this.compositor.layers[nextLayerIdx])
  },
  grabLayer(layer) {
    this.compositor.grabLayer(layer)
  },
  handleModeSelection(layer, modePopup, e) {
    if (e.target.hasAttribute('layer-mode'))
    {
      let selection = e.target.getAttribute('layer-mode')
      this.compositor.setLayerBlendMode(layer, selection)
      modePopup.components['popup-button'].closePopup()
    }
  },
  popoutLayer(layer) {
    const geometrySize = 3
    let gWidth = layer.width / Compositor.data.baseWidth * geometrySize
    let gHeight = layer.height / Compositor.data.baseWidth * geometrySize

    let el = document.createElement('a-entity')
    el.setAttribute('geometry', `primitive: plane; width: ${gWidth}; height: ${gHeight}`)
    el.setAttribute('material', {shader: 'flat'})
    el.setAttribute('layer-preview', AFRAME.utils.styleParser.stringify({compositor: `#${Compositor.el.id}`, layer: layer.id}))
    el.setAttribute('draw-canvas', {canvas: layer.canvas})
    el.setAttribute('canvas-updater', "throttle: 10")
    el.setAttribute('frame', "")
    el.classList.add("canvas")
    document.querySelector('#canvas-root').append(el)
    Util.whenLoaded(el, () => {
      Util.positionObject3DAtTarget(el.object3D, this.shelves[layer.id].object3D, {transformOffset: {x: -0.5, y: -0.5, z: 0.5}})
    })
  },
  resampleLayer(layer) {
    var width = parseInt(document.querySelector('*[settings-shelf] .width').getAttribute('text').value)
    var height = parseInt(document.querySelector('*[settings-shelf] .height').getAttribute('text').value)

    var {width, height} = Util.validateSize({width, height})

    var resampleCanvas = document.createElement('canvas')
    resampleCanvas.width = width
    resampleCanvas.height = height
    var resampleCtx = resampleCanvas.getContext('2d')
    resampleCtx.globalCompositeOperation = 'copy'
    resampleCtx.drawImage(layer.canvas, 0, 0, width, height)

    layer.resize(width, height)

    layer.canvas.getContext('2d').drawImage(resampleCanvas, 0, 0, width, height)

    layer.touch()
    Compositor.el.emit('layerupdated', {layer})
  },
  newNode(node, e) {
    this.nextNodePosition = this.nextNodePosition || new THREE.Vector3()
    this.nextNodePosition.copy(this.shelves[node.id].getAttribute('position'))
    let r = 1.4
    let theta = Math.random() * 2 * Math.PI
    this.nextNodePosition.x += r * Math.cos(theta)
    this.nextNodePosition.y += r * Math.sin(theta)
    this.addNodeShelf(new CanvasNode(this.compositor))
  },
  deleteNode(node, e) {
    this.compositor.deleteNode(node)
  },
  toggleModeNode(node) {
    this.modePopup.setAttribute('visible', true)
    this.modePopup.setAttribute('position', `0 ${this.shelves[node.id].getAttribute('position').y} 0.3`)
    this.modePopup.activeLayer = node
  },
  toggleFxNode(node) {
    let currentIdx = FX.indexOf(node.shader)
    node.changeShader(FX[(currentIdx + 1) % FX.length])
  },
  grabNode(node) {
    this.compositor.grabLayer(node)
  },
  soloNode(node) {
    node.solo = !node.solo
  },
  convertToLayerNode(node) {
    let layer = new Layer(this.compositor.width, this.compositor.height)
    node.draw(layer.canvas.getContext('2d'), this.compositor.currentFrame, {mode: 'copy'})
    layer.shelfMatrix.copy(node.shelfMatrix)
    layer.mode = 'source-over'

    let offsetMatrix = this.pool('offset', THREE.Matrix4)
    offsetMatrix.makeTranslation(0, 0, 0.1)
    layer.shelfMatrix.multiply(offsetMatrix)

    this.compositor.addLayer(this.compositor.layers.length - 1, {layer})
  },
  compositor_componentchanged(e) {
    if (!this.compositor) return
    if (e.detail.name === 'compositor')
    {
      if (this.compositor.data.useNodes)
      {
        let identity = this.pool('identity', THREE.Matrix4)
        identity.identity()

        this.el.querySelectorAll('.node-shelf').forEach(el => {
          el.setAttribute('visible', true)
        })
        this.el.querySelectorAll('*[node-output]').forEach(el => {
          el.setAttribute('visible', true)
        })
        for (let layer of this.compositor.layers)
        {
          if (layer.shelfMatrix.equals(identity))
          {
            layer.shelfMatrix.makeScale(0.2, 0.2, 0.2)
            layer.shelfMatrix.setPosition(Math.random() * 0.2 * Compositor.component.layers.length,
                              Math.random() * 0.2 * Compositor.component.layers.length,
                              Math.random() * 0.2)
          }
          this.shelves[layer.id].object3D.matrix.copy(layer.shelfMatrix)
          layer.shelfMatrix.decompose(
            this.shelves[layer.id].object3D.position,
            this.shelves[layer.id].object3D.quaternion,
            this.shelves[layer.id].object3D.scale
          )
          this.shelves[layer.id].querySelector('*[shelf]')['redirect-grab'] = this.shelves[layer.id]
        }
      }
      else
      {
        this.el.querySelectorAll('.node-shelf').forEach(el => {
          el.setAttribute('visible', false)
        })
        this.el.querySelectorAll('*[node-output]').forEach(el => {
          el.setAttribute('visible', false)
        })
        for (let layer of this.compositor.layers)
        {
          this.shelves[layer.id].object3D.scale.set(0.3,0.3,0.3)
          this.shelves[layer.id].object3D.rotation.set(0,0,0)
          this.shelves[layer.id].querySelector('*[shelf]')['redirect-grab'] = this.el
        }
        this.shuffle()
      }

      this.el.sceneEl.emit('refreshobjects')
    }
  },
  compositor_activelayerchanged(e) {
    let {layer, oldLayer} = e.detail
    console.log("Activating layer", layer)
    if (oldLayer && oldLayer.id in this.shelves) {
      this.shelves[oldLayer.id].querySelector('.active-indicator').setAttribute('visible', "false")
    }
    if (layer && layer.id in this.shelves)
    {
      this.shelves[layer.id].querySelector('.active-indicator').setAttribute('visible', "true")
    }
  },
  compositor_layerdeleted(e) {
    let {layer} = e.detail

    if (layer.id in this.shelves)
    {
      let shelf = this.shelves[layer.id]
      delete this.shelves[layer.id]
      this.el.removeChild(shelf)
    }

    this.shuffle()
    console.log("Full layer deleted")
  },
  compositor_layeradded(e) {
    let {layer} = e.detail
    if (!(layer.id in this.shelves))
    {
      this.addLayerShelf(layer)
    }
    this.shuffle()
  },
  compositor_layerupdated(e) {
    let {layer} = e.detail

    if (!(layer.id in this.shelves)) return;
    if (!this.shelves[layer.id].hasLoaded) return
    if (layer.constructor == CanvasNode) {
      this.compositor_nodeupdated({detail: {node: layer}})
      return
    }

    try {
      if (this.shelves[layer.id].querySelector('.mode-text').hasLoaded)
      {
        this.shelves[layer.id].querySelector('.mode-text').setAttribute('text', {value: `Mode: ${layer.mode}`})
      }
      if (this.shelves[layer.id].querySelector('.frame-count').hasLoaded)
      {
        this.shelves[layer.id].querySelector('.frame-count').setAttribute('text', {value: `${layer.frames.length > 1 ? layer.frames.length : ""}`})
      }
    } catch (e) {console.error("No text for", this.shelves[layer.id])}

    this.shelves[layer.id].querySelector('.active-indicator').setAttribute('visible', layer.active && !layer.grabbed)
    this.shelves[layer.id].querySelector('.grabbing-indicator').setAttribute('visible', layer.grabbed)
    this.shelves[layer.id].querySelector('*[opacity-picker]').components['opacity-picker'].layer = layer
    this.shelves[layer.id].querySelector('*[opacity-picker]').components['opacity-picker'].adjustIndicator(layer.opacity)
    this.shelves[layer.id].querySelector('.invisible-indicator').setAttribute('visible', !layer.visible)
  },
  compositor_layersmoved(e) {
    console.log("Layers moved")
    this.shuffle()
  },
  compositor_nodeadded(e) {
    console.log("Node added")
    let {node} = e.detail
    if (!(node.id in this.shelves))
    {
      this.addNodeShelf(node)
    }
  },
  compositor_nodedeleted(e) {
    let {node} = e.detail
    if (!(node.id in this.shelves)) return

    let shelf = this.shelves[node.id]
    delete this.shelves[node.id]
    this.el.removeChild(shelf)
  },
  compositor_nodeconnectionschanged(e) {
    let {node} = e.detail
    this.rebuildNodeConnections(node)
  },
  compositor_nodeupdated(e) {
    let node = e.detail.node || e.detail.layer
    this.shelves[node.id].querySelector('.mode-text').setAttribute('text', {value: `Mode: ${node.mode}`})
    this.shelves[node.id].querySelector('.grabbing-indicator').setAttribute('visible', node.grabbed)
  }
})
