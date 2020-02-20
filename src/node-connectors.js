import {Pool} from './pool.js'
AFRAME.registerComponent('node-output', {
  schema: {
    snapThreshold: {default: 0.4}
  },
  init() {
    Pool.init(this)
    let radius = 0.1
    this.el.setAttribute("geometry", `primitive: circle; radius: ${radius}`)
    this.el.setAttribute("material", "color: #34eb80")
    this.el.classList.add("clickable")

    let grabber = document.createElement('a-sphere')
    this.grabber = grabber
    grabber.classList.add("clickable")
    grabber.setAttribute('material', "color: #34eb80")
    grabber.setAttribute('radius', radius)
    this.el.append(grabber)
    this.el['redirect-grab'] = grabber

    this.grabLine = new THREE.Geometry();
    this.grabLine.vertices.push(new THREE.Vector3(0,0,0));
    this.grabLine.vertices.push(new THREE.Vector3(0,0,0));
    this.grabLineObject = new THREE.Line(this.grabLine, new THREE.LineBasicMaterial( { color: 0x34eb80, linewidth: 50 } ))
    this.el.object3D.add(this.grabLineObject);

    grabber.addEventListener('stateadded', e => {
      if (e.detail == 'grabbed') {
        this.grabber.object3D.position.set(0, 0, 0)
      }
    })

    grabber.addEventListener('stateremoved', e => {
      console.log("stateremoved", e)
      if (e.detail === 'grabbed') {
        this.dropGrabber()
      }
    })
  },
  tick() {
    if (this.grabber.is('grabbed'))
    {
      this.snapToInput()
      this.grabLine.vertices[1].copy(this.grabber.object3D.position)
      this.grabLine.verticesNeedUpdate = true
    }
  },
  dropGrabber() {
    if (!this.snapToInput())
    {
      this.grabber.object3D.position.set(0, 0, 0)
    }
  },
  snapToInput() {
    let snapThreshold = this.data.snapThreshold
    let thisWorld = this.pool('thisWorld', THREE.Vector3)
    let grabberObj = this.grabber.object3D
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

    if (this.snappedTo != snapped)
    {
      let oldSnapped = this.snappedTo
      this.snappedTo = snapped
      if (oldSnapped) oldSnapped.emit('unsnapped')

      if (snapped)
      {
        this.el.emit('snappedtooutput', {snapped})
        snapped.emit('snappedtoinput', {snapped: this.el})
      }
      else
      {
        this.el.emit('unsnapped')
      }
    }

    return snapped
  }
})

AFRAME.registerComponent('node-input', {
  init() {
    let radius = 0.1
    this.el.setAttribute("geometry", `primitive: circle; radius: ${radius}`)
    this.el.setAttribute("material", "color: #f57242")
    // this.el.classList.add("clickable")
  },
})
