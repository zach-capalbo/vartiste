const layerShelfHTML = require('./partials/layer-view.html.slm')
const modeSelectionHTML = require('./partials/mode-shelf.html.slm')

const {LAYER_MODES} = require('./layer-modes.js')
const {MaterialNode, CanvasNode} = require('./layer.js')
const {Util} = require('./util.js')

AFRAME.registerComponent("layer-shelves", {
  schema: {compositor: {type: 'selector'}},
  init() {
    this.built = false
    this.shelves = {}
    this.compositorEvents = Object.getOwnPropertyNames(Object.getPrototypeOf(this)).filter(k => k.startsWith("compositor_")).map(k => k.slice("compositor_".length))
    for (let e of this.compositorEvents)
    {
      this['compositor_' + e] = this['compositor_' + e].bind(this)
    }

    this.modePopup = document.createElement('a-entity')
    this.modePopup.innerHTML = modeSelectionHTML
    this.modePopup.setAttribute('position', "0 -999999 0")
    this.modePopup.setAttribute('scale', "0.3 0.3 0.3")
    this.modePopup.setAttribute('visible', false)
    this.el.append(this.modePopup)

    this.modePopup.addEventListener('click', e => this.handleModeSelection(e))
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
    let layerIdx = this.compositor.layers.indexOf(layer)
    console.log("Adding shelf for", layer, layerIdx)
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
    console.log("Adding shelf for ", node)
    let container = document.createElement('a-entity')
    container.node = node

    container.innerHTML = require(`./partials/${node.constructor.name.toLowerCase()}-view.html.slm`)
    container.classList.add("node-shelf")

    container.addEventListener('click', e => {
      if (!e.target.hasAttribute('click-action')) return

      console.log("Clicked", e.target.getAttribute('click-action'))
      this[e.target.getAttribute('click-action') + 'Node'](node, e)
    })

    container.setAttribute('position', this.nextNodePosition || {x: 1.4, y: 0, z: 0})
    container.setAttribute('scale', {x: 0.3, y: 0.3, z: 0.3})

    let shelfRoot = container.querySelector('*[shelf]') || container.querySelector('.node-root')

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

    if (!this.compositor.data.useNodes)
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

      console.log("Rebuilding connection", outputNodeShelf)

      Util.whenLoaded([outputNodeShelf, shelf], () => {
        let toNodeInput = Array.from(shelf.querySelectorAll('*[node-input]')).find(el => {
          let input = el.getAttribute('node-input')
          console.log("Checking input", input, connection)
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
  toggleModeLayer(layer) {
    this.modePopup.setAttribute('visible', true)
    this.modePopup.setAttribute('position', `0 ${this.shelves[layer.id].getAttribute('position').y} 0.3`)
    this.modePopup.activeLayer = layer
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
  handleModeSelection(e) {

    if (!this.modePopup.activeLayer) return

    if (e.target.hasAttribute('layer-mode'))
    {
      let selection = e.target.getAttribute('layer-mode')
      this.compositor.setLayerBlendMode(this.modePopup.activeLayer, selection)
    }

    if (e.target.hasAttribute('layer-mode') || e.target.getAttribute('click-action') === 'close-mode')
    {
      this.modePopup.setAttribute('visible', false)
      this.modePopup.setAttribute('position', "0 -999999 0")
      this.el.sceneEl.emit('refreshobjects')
    }
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
  grabNode(node) {
    this.compositor.grabLayer(node)
  },
  compositor_componentchanged(e) {
    if (!this.compositor) return
    if (e.detail.name === 'compositor')
    {
      if (this.compositor.data.useNodes)
      {
        this.el.querySelectorAll('.node-shelf').forEach(el => {
          el.setAttribute('visible', true)
        })
        this.el.querySelectorAll('*[node-output]').forEach(el => {
          el.setAttribute('visible', true)
        })
        for (let layer of this.compositor.layers)
        {
          this.shelves[layer.id].object3D.matrix.copy(layer.shelfMatrix)
          layer.shelfMatrix.decompose(
            this.shelves[layer.id].object3D.position,
            this.shelves[layer.id].object3D.quaternion,
            this.shelves[layer.id].object3D.scale
          )
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
        }
        this.shuffle()
      }
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

  }
})
