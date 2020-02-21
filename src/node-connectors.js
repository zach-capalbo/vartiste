import {Pool} from './pool.js'

AFRAME.registerComponent('node-grabber', {
  init() {
  },
  tick() {
    let grabber = this.el

    if (grabber.is('grabbed'))
    {
      grabber.object3D.visible = true
      this.el.parentEl.components['node-output'].snapToInput(grabber)
      grabber.grabLine.vertices[1].copy(grabber.object3D.position)
      grabber.grabLine.verticesNeedUpdate = true
    }
    else
    {
      grabber.object3D.visible = false
    }
  },
  remove() {
    this.el.parentEl.components['node-output'].remove(grabber.grabLineObject)
  }
})

AFRAME.registerComponent('node-output', {
  schema: {
    snapThreshold: {default: 0.4},
    radius: {default: 0.1}
  },
  init() {
    Pool.init(this)
    let radius = this.data.radius
    this.el.setAttribute("geometry", `primitive: circle; radius: ${radius}`)
    this.el.setAttribute("material", "color: #34eb80")
    this.el.classList.add("clickable")

    this.createGrabber()

    this.el.addEventListener('unsnapped', e => {
      let {grabber} = e.detail
      grabber.object3D.position.set(0, 0, 0)
      grabber.snappedTo = undefined

      if (!grabber.grabber.is('grabbed'))
      {
        grabber.grabLine.vertices[1].set(0, 0, 0)
        grabber.grabLine.verticesNeedUpdate = true
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

    this.grabLine = new THREE.Geometry();
    this.grabLine.vertices.push(new THREE.Vector3(0,0,0));
    this.grabLine.vertices.push(new THREE.Vector3(0,0,0));
    this.grabLineObject = new THREE.Line(this.grabLine, new THREE.LineBasicMaterial( { color: 0x34eb80, linewidth: 50 } ))
    grabber.grabLineObject = this.grabLineObject
    grabber.grabLine = this.grabLine
    this.el.object3D.add(this.grabLineObject);
  },
  dropGrabber(grabber) {
    let snapped = this.snapToInput(grabber)

    if (!snapped)
    {
      grabber.object3D.position.set(0, 0, 0)
      grabber.grabLine.vertices[1].set(0,0,0)
      grabber.grabLine.verticesNeedUpdate = true

      if (grabber !== this.grabber)
      {
        grabber.grabLine.visible = false
        this.el.removeChild(grabber)
      }
    }

    if (grabber.snappedTo != snapped)
    {
      let oldSnapped = grabber.snappedTo
      grabber.snappedTo = snapped
      if (oldSnapped) oldSnapped.emit('unsnapped', {snapped: this.el, grabber})

      if (snapped)
      {
        this.el.emit('snappedtooutput', {snapped, grabber})
        snapped.emit('snappedtoinput', {snapped: this.el, grabber})
        this.createGrabber()
      }
      else
      {
        this.el.emit('unsnapped', {snapped: oldSnapped, grabber})
      }
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
    index: {default: 0}
  },
  init() {
    let radius = 0.1
    this.el.setAttribute("geometry", `primitive: circle; radius: ${radius}`)
    if (!this.el.hasAttribute('material')) this.el.setAttribute("material", "color: #f57242")
    this.el.classList.add("clickable")

    this.el['redirect-grab'] = this.el.parentEl

    this.el.addEventListener('snappedtoinput', e => {
      let {snapped, grabber} = e.detail
      if (this.snappedTo !== snapped) {
        if (this.snappedTo)
        {
          this.snappedTo.emit('unsnapped')
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
  tick() {
    if (this.snappedTo && !this.snappedGrabber.is("grabbed"))
    {
      let {grabLine} = this.snappedGrabber
      this.el.object3D.getWorldPosition(grabLine.vertices[1])
      this.snappedTo.object3D.worldToLocal(grabLine.vertices[1])
      this.snappedGrabber.object3D.position.copy(grabLine.vertices[1])
      grabLine.verticesNeedUpdate = true
    }
  }
})
