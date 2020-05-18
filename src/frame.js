import {Util} from './util.js'
import {Pool} from './pool.js'

AFRAME.registerSystem('frame', {
  init() {
    this.pinnedTargets = {}
  },
  pinFrameTo(frame, target) {
    this.pinnedTargets[target.id] = this.pinnedTargets[target.id] || []
    let targetList = this.pinnedTargets[target.id]

    var nextIdx = -1; while (typeof targetList[++nextIdx] !== 'undefined');

    targetList[nextIdx] = frame
    return nextIdx
  },
  unpinFrameFrom(frame, target) {
    this.pinnedTargets[target.id] = this.pinnedTargets[target.id] || []
    let idx = this.pinnedTargets[target.id].indexOf(frame)

    if (idx >= 0)
    {
      this.pinnedTargets[target.id][idx] = undefined
    }
  }
})

AFRAME.registerComponent("frame", {
  schema: {
    closable: {default: true},
    pinnable: {default: true},
    outline: {default: true},
    outlineColor: {type: 'color', default: "#52402b"},
    geometryTarget: {type: 'selector'}
  },
  events: {
    click: function (e) {
      if (e.target.hasAttribute('frame-action'))
      {
        this[e.target.getAttribute('frame-action')](e)
      }
    }
  },
  init() {
    Pool.init(this)
    let {width, height} = (this.data.geometryTarget || this.el).getAttribute('geometry')

    let buttonCount = 0

    if (this.data.closable)
    {
      let closeButton = document.createElement('a-entity')
      closeButton.setAttribute('icon-button', '#asset-close-circle-outline')
      closeButton.setAttribute('button-style', 'buttonType: plane; color: #26211c')
      closeButton.setAttribute('position', `${width / 2 - 0.055 - buttonCount++ * 0.6} ${height / 2 + 0.055} 0`)
      closeButton.setAttribute('scale', `0.3 0.3 1`)
      closeButton.setAttribute('frame-action', "closeFrame")
      this.el.append(closeButton)
    }

    if (this.data.pinnable) {
      let closeButton = document.createElement('a-entity')
      closeButton.setAttribute('icon-button', '#asset-hand-right')
      closeButton.setAttribute('button-style', 'buttonType: plane; color: #26211c')
      closeButton.setAttribute('position', `${width / 2 - 0.055 - buttonCount++ * 0.6} ${height / 2 + 0.055} 0`)
      closeButton.setAttribute('scale', `0.3 0.3 1`)
      closeButton.setAttribute('frame-action', "pinFrame")
      this.el.append(closeButton)
    }
  },
  update(oldData) {
    let {width, height} = (this.data.geometryTarget || this.el).getAttribute('geometry')

    if (this.data.outline && !this.lineObject)
    {
      let zOffset = -0.001
      let outline = new THREE.Geometry()
      outline.vertices.push(new THREE.Vector3(-width / 2, height / 2, zOffset));
      outline.vertices.push(new THREE.Vector3(width / 2, height / 2, zOffset));
      outline.vertices.push(new THREE.Vector3(width / 2, - height / 2, zOffset));
      outline.vertices.push(new THREE.Vector3(-width / 2, - height / 2, zOffset));
      outline.vertices.push(new THREE.Vector3(-width / 2, height / 2, zOffset));

      let lineObject = new THREE.Line(outline, new THREE.LineBasicMaterial( { color: this.data.outlineColor, linewidth: 5 } ))
      this.el.object3D.add(lineObject)
      this.lineObject = lineObject
    }
    else if (!this.data.outline && this.lineObject)
    {
      this.el.object3D.remove(this.lineObject)
      delete this.lineObject
    }
  },
  closeFrame() {
    this.el.parentEl.removeChild(this.el)
  },
  pinFrame(e) {
    if (this.el.is('pinned'))
    {
      this.system.unpinFrameFrom(this, this.el.object3D.parent.el)
      this.el.object3D.parent.remove(this.el.object3D)
      this.originalParent.add(this.el.object3D)
      Util.applyMatrix(this.originalMatrix, this.el.object3D)
      this.el.removeState('pinned')
      return
    }

    let cursorEl = e.detail.cursorEl
    if (!cursorEl) {
      throw new Error("No cursor in event", e)
    }

    let {width, height} = (this.data.geometryTarget || this.el).getAttribute('geometry')
    let scale = this.el.getAttribute('scale')

    this.originalMatrix = this.originalMatrix || new THREE.Matrix4()
    this.originalMatrix.copy(this.el.object3D.matrix)
    this.originalParent = this.el.object3D.parent

    let target
    let offset = this.pool('offset', THREE.Vector3)
    let pinSize = this.pool('pinSize', THREE.Vector3)
    pinSize.set(0.1, 0.1, 0.1)
    if (cursorEl.id === 'right-hand')
    {
      target = document.querySelector('#left-hand')
      let pinIdx = this.system.pinFrameTo(this, target)
      offset.set(0, height / 2 * scale.y * pinSize.y, 0)
    }
    else if (cursorEl.id === 'left-hand')
    {
      target = document.querySelector('#right-hand')
      let pinIdx = this.system.pinFrameTo(this, target)
      offset.set(0, height / 2 * scale.y  * pinSize.y, 0)
    }
    else
    {
      target = document.querySelector('#camera')
      let pinIdx = this.system.pinFrameTo(this, target)
      offset.set(-0.07 + pinIdx * 0.04, -0.07, -0.1)
      pinSize.set(0.01, 0.01, 0.001)
    }

    this.el.object3D.parent.remove(this.el.object3D)
    target.object3D.add(this.el.object3D)

    Util.positionObject3DAtTarget(this.el.object3D, target.object3D, {scale: pinSize, transformOffset: offset})

    this.el.addState('pinned')
  }
})
