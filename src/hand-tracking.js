import {Util} from './util.js'
import {Pool} from './pool.js'
import {Sfx} from './sfx.js'

Util.registerComponentSystem('hand-tracking', {
  init() {

  }
})

AFRAME.registerComponent('hand-touch-button', {
  schema: {
    outerSize: {default: 0.3},
    innerSize: {default: 0.1},
    color: {default: '#aea'},
    throttle: {default: 50}
  },
  init() {
    let box = document.createElement('a-entity')
    box.setAttribute('geometry', 'primitive: box;')
    box.setAttribute('material', 'shader: matcap; wireframe: true; color: #aea')
    this.el.append(box)
    this.outerBox = box

    let innerBox = document.createElement('a-entity')
    innerBox.setAttribute('geometry', 'primitive: box;')
    innerBox.setAttribute('material', 'shader: matcap; wireframe: false; color: #aea')
    this.innerBox = innerBox
    this.el.append(innerBox)
    Pool.init(this)

    this.tick = AFRAME.utils.throttleTick(this.tick, this.data.throttle, this)
  },
  update(oldData) {
    this.outerBox.setAttribute('geometry', 'width', this.data.outerSize)
    this.outerBox.setAttribute('geometry', 'height', this.data.outerSize)
    this.outerBox.setAttribute('geometry', 'depth', this.data.outerSize)
    this.outerBox.setAttribute('material', 'color', this.data.color)

    this.innerBox.setAttribute('geometry', 'width', this.data.innerSize)
    this.innerBox.setAttribute('geometry', 'height', this.data.innerSize)
    this.innerBox.setAttribute('geometry', 'depth', this.data.innerSize)
    this.innerBox.setAttribute('material', 'color', this.data.color)
  },
  checkIntersection(otherEl) {
    if (!this.el.object3D.visible) return
    let parentVisible = true
    this.el.object3D.traverseAncestors(a => parentVisible = parentVisible && a.visible)
    if (!parentVisible) return false

    let otherPos = this.pool('otherPos', THREE.Vector3)
    otherEl.object3D.getWorldPosition(otherPos)

    this.el.object3D.worldToLocal(otherPos)

    if (Math.abs(otherPos.x) < this.data.outerSize
        && Math.abs(otherPos.y) < this.data.outerSize
        && Math.abs(otherPos.z) < this.data.outerSize)
    {
      if (!this.hovered)
      {
        this.el.emit('mouseenter')
        this.hovered = true
        this.el.addState('hovered')
      }
    }
    else
    {
      if (this.hovered)
      {
        this.el.emit('mouseleave')
        this.hovered = false
        this.el.removeState('hovered')
      }
    }

    if (Math.abs(otherPos.x) < this.data.innerSize
        && Math.abs(otherPos.y) < this.data.innerSize
        && Math.abs(otherPos.z) < this.data.innerSize)
    {
      if (!this.clicked)
      {
        Sfx.click(this.el)
        this.el.emit('click')
        this.el.addState('clicked')
        this.clicked = true
      }
    }
    else
    {
      if (this.clicked) {
        this.el.removeState('clicked')
        this.clicked = false
      }
    }

  },
  tick(t,dt) {
    this.checkIntersection(document.querySelector('#left-hand'))
  }
})

AFRAME.registerComponent('hand-helper', {
  schema: {
    hand: {oneOf: ['left', 'right']}
  },
  events: {
    gripdown: function(e) {
      if (e.detail && e.detail.type === 'hand')
      {
        this.otherHandHelper.showGripMenu()
      }
    },
    gripup: function(e) {
      if (e.detail && e.detail.type === 'hand')
      {
        this.otherHandHelper.hideGripMenu()
      }
    }
  },
  init() {
    this.otherHandEl = document.querySelector(`#${this.data.hand === 'left' ? 'right' : 'left'}-hand`)
    Util.whenLoaded(this.otherHandEl, () => this.otherHandHelper = this.otherHandEl.components['hand-helper'])

    let menu = document.createElement('a-entity')
    this.el.append(menu)

    menu.innerHTML = require('./partials/hand-menu.html.slm')
    this.menu = menu
    Util.whenLoaded(menu, () => {
      menu.querySelectorAll('.menu').forEach(el => el.setAttribute('visible', false))
      document.querySelector('#artist-root').object3D.add(menu.object3D)
    })
  },
  showGripMenu() {
    Util.positionObject3DAtTarget(this.menu.object3D, this.el.object3D)
    this.menu.object3D.rotation.set(0,0,0)
    this.menu.querySelector('.grip-menu').setAttribute('visible', true)
  },
  hideGripMenu() {
    this.menu.querySelector('.grip-menu').setAttribute('visible', false)
  }
})
