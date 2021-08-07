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

// A 2D border and buttons that go around an entity. One prominent use is in the
// [`shelf`](#shelf) component.
AFRAME.registerComponent("frame", {
  schema: {
    // If true, there's an X button to "close" (i.e., `remove()`) the entity
    closable: {default: true},
    // If true, there's a hand button to pin the entity to the user's hand
    pinnable: {default: true},

    // If true, the close button hides the entity instead of removing it
    hideOnly: {default: false},

    closePopup: {default: false},

    // If true, there's a visible border around the entity
    outline: {default: true},
    outlineColor: {type: 'color', default: "#52402b"},
    tooltipStyle: {type: 'string', default: "scale: 3 3 3; offset: 0 1.0 0"},

    // If set, uses the selector element as the source of the geometry for the frame,
    // rather than the current element
    geometryTarget: {type: 'selector'},
    useBounds: {default: false},

    autoHide: {default: false},
    autoHideTimeout: {default: 500},

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
        e.stopPropagation()
      }
    },
    'raycaster-intersected': function(e) {
      if (this.data.autoHide)
      {
        if (this.hideTiemout)
        {
          window.clearTimeout(this.hideTiemout)
          this.hideTiemout = null
        }
        this.unhide()
      }
    },
    'raycaster-intersected-cleared': function(e) {
      if (this.data.autoHide)
      {
        this.startAutoHide()
      }
    },
  },
  init() {
    Pool.init(this)
    let target = (this.data.geometryTarget || this.el)
    this.center = new THREE.Vector3;
    this.updateBounds();
    let {width, height} = this;

    target.addEventListener('componentinitialized', (e) => {
      if (e.detail.name === 'geometry')
      {
        this.update(this.data)
      }
    })

    this.buttonCount = 0

    this.buttonRow = document.createElement('a-entity')
    this.el.append(this.buttonRow)

    this.objects = []

    if (this.data.autoHide)
    {
      Util.whenLoaded(this.el, () => this.startAutoHide())
    }
  },
  remove() {
    if (this.lineObject) {
      if (this.lineObject.parent)
      {
        this.lineObject.parent.remove(this.lineObject)
      }
    }
    for (let object of this.objects)
    {
      if (object.parentEl)
      {
        object.parentEl.remove(object)
      }
    }
    this.objects = []
  },
  updateBounds() {
    let width, height;

    if (this.data.useBounds)
    {
      let target = (this.data.geometryTarget || this.el)
      let box;
      if (!target.getObject3D('mesh') || !target.getObject3D('mesh').geometry)
      {
        let m = this.pool('inv', THREE.Matrix4)
        box = Util.recursiveBoundingBox(target.object3D)
        m.copy(target.object3D.matrixWorld).invert()
        box.applyMatrix4(m)
        box.expandByScalar(0.3)
        box.getCenter(this.center)
        width = (box.max.x - box.min.x)
        height = (box.max.y - box.min.y)
      }
      else
      {
        target.getObject3D('mesh').geometry.computeBoundingBox()
        box = target.getObject3D('mesh').geometry.boundingBox
        width = (box.max.x - box.min.x) * target.getObject3D('mesh').scale.x
        height = (box.max.y - box.min.y) * target.getObject3D('mesh').scale.y
      }
      console.log("Bounds", box, width, height)
    }
    else
    {
      let geometry = (this.data.geometryTarget || this.el).getAttribute('geometry')
      width = geometry.width
      height = geometry.height
    }
    this.width = width;
    this.height = height;
  },
  update(oldData) {
    if (!this.objects) return
    this.updateBounds();
    let {width, height} = this;

    if (this.data.closable && !oldData.closable)
    {
      let closeButton = this.addButton('#asset-close-circle-outline')
      closeButton.setAttribute('frame-action', "closeFrame")
      closeButton.setAttribute('tooltip', "Close")
      closeButton.setAttribute('tooltip-style', this.data.tooltipStyle)
    }
    else if (!this.data.closable && oldData.closable)
    {
      this.removeButton('#asset-close-circle-outline')
    }

    if (this.data.pinnable && !oldData.pinnable) {
      let closeButton = this.addButton('#asset-hand-right')
      closeButton.setAttribute('frame-action', "pinFrame")
      closeButton.setAttribute('tooltip', "Pin / Unpin to opposite hand")
      closeButton.setAttribute('tooltip-style', this.data.tooltipStyle)
    }
    else if (!this.data.pinnable && oldData.pinnable) {
      this.removeButton('#asset-close-circle-outline')
    }

    if (this.data.name && !this.title)
    {
      let {width, height} = this
      let title = document.createElement('a-entity')
      title.setAttribute('geometry', 'primitive: plane; height: 0; width: 0')
      title.setAttribute('material', 'color: #26211c; shader: flat')
      title.setAttribute('position', `${- width / 4 + 0.055 + this.center.x} ${height / 2 + 0.055 + this.center.y} ${this.center.z}`)
      title.setAttribute('text', `color: #FFF; width: ${width / 2}; align: left; value: ${this.data.name}; wrapCount: 20; zOffset: 0.005`)
      title.setAttribute('class', 'raycast-invisible')
      this.el.append(title)
      // title.addEventListener('textfontset', () => title.setAttribute('geometry', 'primitive: plane; height: auto; width: auto'))
      // Util.whenLoaded([this.el, title], () => title.setAttribute('geometry', 'primitive: plane; height: auto; width: 1'))
      this.objects.push(title.object3D)
      this.title = title
    }
    else if (this.data.name && this.data.name !== oldData.name)
    {
      this.title.setAttribute('text', 'value', this.data.name)
    }

    let zOffset = -0.001
    if (this.data.outline && !this.lineObject && !isNaN(width) && !isNaN(height))
    {
      let outline = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-width / 2, height / 2, zOffset),
      new THREE.Vector3(width / 2, height / 2, zOffset),
      new THREE.Vector3(width / 2, - height / 2, zOffset),
      new THREE.Vector3(-width / 2, - height / 2, zOffset),
      new THREE.Vector3(-width / 2, height / 2, zOffset)]);

      let lineObject = new THREE.Line(outline, new THREE.LineBasicMaterial( { color: this.data.outlineColor, linewidth: 5 } ))
      this.el.object3D.add(lineObject)
      this.lineObject = lineObject
      this.objects.push(lineObject)
    }
    else if (this.data.outline && this.lineObject)
    {
      this.lineObject.geometry.vertices[0].set(-width / 2, height / 2, zOffset);
      this.lineObject.geometry.vertices[1].set( width / 2, height / 2, zOffset);
      this.lineObject.geometry.vertices[2].set(width / 2, - height / 2, zOffset);
      this.lineObject.geometry.vertices[3].set(-width / 2, - height / 2, zOffset);
      this.lineObject.geometry.vertices[4].set(-width / 2, height / 2, zOffset);
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

    this.width = width
    this.height = height
    this.relayout()

    if (this.data.autoHide)
    {
      Util.whenLoaded(this.el, () => this.startAutoHide())
    }
  },
  addButton(icon) {
    let {width, height} = this
    let button = document.createElement('a-entity')
    button.setAttribute('icon-button', icon)
    button.setAttribute('button-style', 'buttonType: plane; color: #26211c')
    button.setAttribute('position', `${width / 2 - 0.055 - this.buttonCount++ * 0.6} ${height / 2 + 0.055} 0`)
    button.setAttribute('scale', `0.3 0.3 0.3`)
    button.setAttribute('tooltip-style', this.data.tooltipStyle)
    this.buttonRow.append(button)
    this.objects.push(button)
    return button
  },
  removeButton(icon) {
    let button = this.objects.find(o => o.getAttribute('icon-button') === icon)
    if (!button) {
      console.warn("Can't find icon to remove button", icon)
      return
    }
    idx = this.objects.indexOf(button)
    this.objects.splice(idx, 1)
    this.buttonRow.remove(button)
  },
  relayout() {
    let i = 0;
    let {width, height} = this;
    for (let b of this.buttonRow.children)
    {
      b.setAttribute('position', `${width / 2 - 0.055 - i++ * 0.6} ${height / 2 + 0.055} 0`)
    }

    if (this.lineObject) this.lineObject.position.copy(this.center)
    this.buttonRow.object3D.position.copy(this.center)
  },
  closeFrame() {
    if (this.data.closePopup)
    {
      this.el.emit('popupaction', 'close')
    }
    else if (this.data.hideOnly)
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
    if (!this.objects) return;

    for (let o of this.objects)
    {
      o = (o.object3D) ? o.object3D : o
      o.visible = false
    }
  },

  // Unhides a frame hidden by `hide`
  unhide() {
    if (!this.objects) return;

    for (let o of this.objects)
    {
      o = (o.object3D) ? o.object3D : o
      o.visible = true
    }
  },
  startAutoHide() {
    if (this.hideTiemout) return;
    this.hideTiemout = window.setTimeout(() => this.hide(), this.data.autoHideTimeout)
  }
})
