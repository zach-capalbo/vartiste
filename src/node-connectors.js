import {Pool} from './pool.js'
import {Util} from './util.js'
import * as NodeTypes from './layer.js'

AFRAME.registerSystem('node-connector-system', {})

AFRAME.registerComponent('node-grabber', {
  init() {
    this.el.setAttribute('grab-options', 'showHand: false')
  },
  tick() {
    let grabber = this.el

    if (grabber.is('grabbed'))
    {
      grabber.object3D.visible = true
      this.el.parentEl.components['node-output'].snapToInput(grabber)
      grabber.grabLine.attributes.position.setXYZ(1, grabber.object3D.position.x, grabber.object3D.position.y, grabber.object3D.position.z)
      grabber.grabLine.attributes.position.needsUpdate = true
    }
    else
    {
      grabber.object3D.visible = false
    }
  },
  remove() {
    let grabber = this.el
    this.el.parentEl.components['node-output'].remove(grabber.grabLineObject)
  }
})

AFRAME.registerComponent('node-output', {
  schema: {
    snapThreshold: {default: 0.4},
    radius: {default: 0.1}
  },
  init() {
    this.system = this.el.sceneEl.systems['node-connector-system']
    Pool.init(this, {useSystem: true})
    let radius = this.data.radius
    this.el.setAttribute("geometry", `primitive: circle; radius: ${radius}; segments: 8`)
    this.el.setAttribute("material", "color: #34eb80; shader: flat")
    this.el.setAttribute('action-tooltips', 'grip: Make Connection')
    this.el.classList.add("clickable")

    this.createGrabber()

    this.el.addEventListener('unsnapped', e => {
      let {grabber} = e.detail
      console.log("Usnapping grabber")//, grabber, grabber.is('grabbed'))
      grabber.object3D.position.set(0, 0, 0)
      grabber.snappedTo = undefined

      if (!grabber.is('grabbed'))
      {
        grabber.grabLine.attributes.position.setXYZ(1, 0, 0, 0)
        grabber.grabLine.attributes.position.needsUpdate = true
        grabber.grabLine.computeBoundingSphere()

        if (grabber !== this.grabber)
        {
          grabber.grabLineObject.visible = false
          this.el.removeChild(grabber)
        }
      }
    })
  },
  tick() {

  },
  createGrabber() {
    let {radius} = this.data
    let grabber = document.createElement('a-sphere')
    this.grabber = grabber
    grabber.classList.add("clickable")
    grabber.setAttribute('material', "color: #34eb80")
    grabber.setAttribute('radius', radius)
    grabber.setAttribute('node-grabber', "")
    grabber.setAttribute('action-tooltips', 'grip: Change Connection')
    this.el.append(grabber)
    this.el['redirect-grab'] = grabber

    grabber.addEventListener('stateadded', e => {
      if (e.detail == 'grabbed') {
        // grabber.object3D.position.set(0, 0, 0)
      }
    })

    grabber.addEventListener('stateremoved', e => {
      console.log("stateremoved", e)
      if (e.detail === 'grabbed') {
        this.dropGrabber(grabber)
      }
    })

    this.grabLine = new THREE.BufferGeometry().setFromPoints([
     new THREE.Vector3(0,0,0),
     new THREE.Vector3(0,0,0)])
    this.grabLineObject = new THREE.Line(this.grabLine, new THREE.LineBasicMaterial( { color: 0x34eb80, linewidth: 50 } ))
    // this.grabLineObject.frustumCulled = false
    grabber.grabLineObject = this.grabLineObject
    grabber.grabLine = this.grabLine
    this.el.object3D.add(this.grabLineObject);
  },
  dropGrabber(grabber) {
    let snapped = this.snapToInput(grabber)

    if (!snapped)
    {
      grabber.object3D.position.set(0, 0, 0)
      grabber.grabLine.attributes.position.setXYZ(1,0,0,0)
      grabber.grabLine.attributes.position.needsUpdate = true
      grabber.grabLine.computeBoundingSphere()
    }

    if (grabber.snappedTo != snapped)
    {
      this.formConnectionTo(grabber, snapped)
    }
  },
  formConnectionTo(grabber, snapped) {
    if (typeof grabber === "undefined") grabber = this.grabber
    console.log("Forming connection")//, grabber, snapped)
    let oldSnapped = grabber.snappedTo
    grabber.snappedTo = snapped
    if (oldSnapped) oldSnapped.emit('unsnapped', {snapped: this.el, grabber})

    if (snapped)
    {
      this.el.emit('snappedtooutput', {snapped, grabber})
      snapped.emit('snappedtoinput', {snapped: this.el, grabber})

      if (grabber === this.grabber)
      {
        this.createGrabber()
      }
    }
    else
    {
      this.el.emit('unsnapped', {snapped: oldSnapped, grabber})
    }
  },
  snapToInput(grabber) {
    let snapThreshold = this.data.snapThreshold
    let thisWorld = this.pool('thisWorld', THREE.Vector3)
    let grabberObj = grabber.object3D
    grabberObj.getWorldPosition(thisWorld)

    let snapped = undefined
    let snapDistance = snapThreshold
    document.querySelectorAll('*[node-input]').forEach(input => {
      if (input.parentEl == this.el.parentEl) return
      let otherWorld = this.pool('otherWorld', THREE.Vector3)
      input.object3D.getWorldPosition(otherWorld)

      if (thisWorld.distanceTo(otherWorld) < snapDistance)
      {
        grabberObj.position.copy(otherWorld)
        grabberObj.parent.worldToLocal(grabberObj.position)
        snapDistance = thisWorld.distanceTo(otherWorld)
        snapped = input
      }
    })

    return snapped
  }
})

AFRAME.registerComponent('node-input', {
  schema: {
    label: {type: "string"},
    type: {type: "string"},
    index: {default: 0},
    compositionNode: {default: true},
  },
  init() {
    this.system = this.el.sceneEl.systems['node-connector-system']
    Pool.init(this, {useSystem: true})
    let radius = 0.1
    this.el.setAttribute("geometry", `primitive: circle; radius: ${radius}; segments: 8`)
    if (!this.el.hasAttribute('material'))
    {
      this.el.setAttribute("material", "color: #f57242; shader: flat")
    }
    else
    {
      Util.whenLoaded(this.el, () => {
        this.el.setAttribute('material', 'shader', 'flat')
      })
    }
    this.el.classList.add("clickable")
    this.lastSnappedWorldPos = new THREE.Vector3;

    this.el['redirect-grab'] = this.el.parentEl

    this.el.addEventListener('snappedtoinput', e => {
      let {snapped, grabber} = e.detail
      if (this.snappedGrabber !== grabber) {
        if (this.snappedTo)
        {
          this.snappedTo.emit('unsnapped', {snapped: this.snappedTo, grabber: this.snappedGrabber})
        }

        this.snappedTo = snapped
        this.snappedGrabber = grabber
        this.el['redirect-grab'] = grabber
      }
    })

    this.el.addEventListener('unsnapped', e => {
      let {snapped, grabber} = e.detail
      this.snappedTo = undefined
      this.snappedGrabber = undefined
      this.el['redirect-grab'] = this.el.parentEl
    })
  },
  remove() {
    this.clearSnapped()
  },
  clearSnapped() {
    if (this.snappedTo)
    {
      this.snappedTo.emit('unsnapped', {snapped: this.snappedTo, grabber: this.snappedGrabber})
      this.snappedTo = undefined
      this.snappedGrabber = undefined
      this.el['redirect-grab'] = this.el.parentEl
    }
  },
  tick() {
    if (this.data.compositionNode && !Compositor.component.data.useNodes) return
    if (this.snappedTo && !this.snappedGrabber.is("grabbed"))
    {
      let {grabLine} = this.snappedGrabber
      let v = this.pool('v', THREE.Vector3)
      this.el.object3D.getWorldPosition(v)
      let v2 = this.pool('v2', THREE.Vector3)
      this.snappedTo.object3D.getWorldPosition(v2)
      if (v2.sub(v).distanceToSquared(this.lastSnappedWorldPos) < 0.00001)
      {
        return
      }

      this.lastSnappedWorldPos.copy(v2)
      this.snappedTo.object3D.worldToLocal(v)
      this.snappedGrabber.object3D.position.copy(v)
      grabLine.attributes.position.setXYZ(1, v.x, v.y, v.z)
      grabLine.attributes.position.needsUpdate = true
      grabLine.computeBoundingSphere()
    }
  }
})

AFRAME.registerComponent('node-control-panel', {
  init() {
    Pool.init(this)
    this.el.querySelector('.globe-control')['redirect-grab'] = document.querySelector('*[layer-shelves]')
    this.el.addEventListener('click', e => {
      console.log("Clicked", e)
      if (e.target.hasAttribute('click-action'))
      {
        let action = e.target.getAttribute('click-action')
        if (action in this) this[action](e)
      }
    })

    Compositor.el.addEventListener('componentchanged', e => {
      if (e.detail.name === 'compositor' && e.target.hasLoaded) {
        this.toggleNodeDisplay()
      }
    })

    Util.whenLoaded(Compositor.el, () => this.toggleNodeDisplay())
  },
  toggleNodeDisplay() {
    let useNodes = Compositor.component.data.useNodes
    this.el.querySelector('.globe-control').setAttribute('visible', useNodes)
    this.el.querySelectorAll('*[new-node-type]').forEach(el => el.setAttribute('visible', useNodes))
    if (useNodes)
    {
      this.el.setAttribute('shelf', 'height', 3)
      this.el.setAttribute('shelf', 'offset', '0 -0.75 0')
    }
    else
    {
      this.el.setAttribute('shelf', 'height', 1.5)
      this.el.setAttribute('shelf', 'offset', '0 0 0')
    }
  },
  newLayer(e) {
    let compositor = Compositor.component

    compositor.addLayer(compositor.layers.length)
    this.position(compositor.layers[compositor.layers.length - 1].shelfMatrix)
  },
  newNode(e) {
    let compositor = Compositor.component
    let type = e.target.getAttribute('new-node-type')
    let node = new NodeTypes[type](compositor)

    this.position(node.shelfMatrix)

    compositor.el.emit('nodeadded', {node})
  },
  position(shelfMatrix) {
    let positionObj = this.el.querySelector('.spawn-point').object3D
    let targetObj = document.querySelector('*[layer-shelves]').object3D
    targetObj.updateMatrixWorld()
    positionObj.updateMatrixWorld()

    shelfMatrix.copy(positionObj.matrixWorld)

    let invMat = this.pool('invMat', THREE.Matrix4)
    invMat.copy(targetObj.matrixWorld).invert()
    shelfMatrix.premultiply(invMat)
  },
  toggleNodes(e) {
    let compositor = Compositor.el
    compositor.setAttribute('compositor', {useNodes: !compositor.getAttribute('compositor').useNodes})
  },
  hideShelves() {
    document.querySelectorAll('*[layer-shelves]').forEach(el => el.setAttribute('visible', !el.getAttribute('visible')))
  }
})
