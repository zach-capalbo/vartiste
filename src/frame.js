import {Util} from './util.js'
import {Pool} from './pool.js'

AFRAME.registerSystem('frame', {
  init() {
    this.pinnedTargets = {}
    this.el.addEventListener('startsnap', () => {
      document.querySelectorAll('*[frame]').forEach(el => el.components.frame.hide())
    })
    this.el.addEventListener('endsnap', () => {
      document.querySelectorAll('*[frame]').forEach(el => el.components.frame.unhide())
    })
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

// A 2D border and buttons that go around an entity
AFRAME.registerComponent("frame", {
  schema: {
    // If true, there's an X button to "close" (i.e., `remove()`) the entity
    closable: {default: true},
    // If true, there's a hand button to pin the entity to the user's hand
    pinnable: {default: true},

    // If true, the close button hides the entity instead of removing it
    hideOnly: {default: false},

    // If true, there's a visible border around the entity
    outline: {default: true},
    outlineColor: {type: 'color', default: "#52402b"},

    // If set, uses the selector element as the source of the geometry for the frame,
    // rather than the current element
    geometryTarget: {type: 'selector'},

    // If true, sets the element to be grabbable by [`manipulator`](#manipulator)
    grabbable: {default: true},

    // Name to display as a title for the frame
    name: {type: 'string'},
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
    this.width = width
    this.height = height

    this.buttonCount = 0

    this.buttonRow = document.createElement('a-entity')
    this.el.append(this.buttonRow)

    this.objects = []

    if (this.data.closable)
    {
      let closeButton = this.addButton('#asset-close-circle-outline')
      closeButton.setAttribute('frame-action', "closeFrame")
      closeButton.setAttribute('tooltip', "Close")
      closeButton.setAttribute('tooltip-style', "scale: 3 3 3; offset: 0 1.0 0")
    }

    if (this.data.pinnable) {
      let closeButton = this.addButton('#asset-hand-right')
      closeButton.setAttribute('frame-action', "pinFrame")
      closeButton.setAttribute('tooltip', "Pin / Unpin to opposite hand")
      closeButton.setAttribute('tooltip-style', "scale: 3 3 3; offset: 0 1.0 0")
    }

    if (this.data.name)
    {
      let {width, height} = this
      let title = document.createElement('a-entity')
      title.setAttribute('geometry', 'primitive: plane; height: auto; width: auto')
      title.setAttribute('material', 'color: #26211c; shader: flat')
      title.setAttribute('position', `${- width / 4 + 0.055} ${height / 2 + 0.055} 0`)
      title.setAttribute('text', `color: #FFF; width: ${width / 2}; align: left; value: ${this.data.name}; wrapCount: 20`)
      title.setAttribute('class', 'raycast-invisible')
      this.el.append(title)
      this.objects.push(title.object3D)
    }
  },
  remove() {
    if (this.lineObject) {
      this.lineObject.parent.remove(this.lineObject)
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
      this.objects.push(lineObject)
    }
    else if (!this.data.outline && this.lineObject)
    {
      this.el.object3D.remove(this.lineObject)
      delete this.lineObject
      this.objects.splice(this.objects.indexOf(this.lineObject), 1)
    }

    if (this.data.grabbable)
    {
      this.el.classList.add('clickable')
    }
    else
    {
      this.el.classList.remove('clickable')
    }
  },
  addButton(icon) {
    let {width, height} = this
    let button = document.createElement('a-entity')
    button.setAttribute('icon-button', icon)
    button.setAttribute('button-style', 'buttonType: plane; color: #26211c')
    button.setAttribute('position', `${width / 2 - 0.055 - this.buttonCount++ * 0.6} ${height / 2 + 0.055} 0`)
    button.setAttribute('scale', `0.3 0.3 1`)
    this.buttonRow.append(button)
    this.objects.push(button)
    return button
  },
  closeFrame() {
    if (this.data.hideOnly)
    {
      this.el.setAttribute('visible', false)
    }
    else
    {
      this.el.parentEl.removeChild(this.el)
    }
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
    let ratio = ((width / height > 4.0 / 3.0 )? 4.0 / width : 3.0 / height)
    pinSize.set(ratio * 0.05, ratio * 0.05, ratio * 0.05)
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
      pinSize.set(ratio * 0.01, ratio * 0.01, 0.001)
    }

    this.el.object3D.parent.remove(this.el.object3D)
    target.object3D.add(this.el.object3D)

    Util.positionObject3DAtTarget(this.el.object3D, target.object3D, {scale: pinSize, transformOffset: offset})

    this.el.addState('pinned')
  },

  // Hides the frame, but not the framed element
  hide() {
    for (let o of this.objects)
    {
      o = (o.object3D) ? o.object3D : o
      o.visible = false
    }
  },

  // Unhides a frame hidden by `hide`
  unhide() {
    for (let o of this.objects)
    {
      o = (o.object3D) ? o.object3D : o
      o.visible = true
    }
  },
})
