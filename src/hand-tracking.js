import {Util} from './util.js'
import {Pool} from './pool.js'
import {Sfx} from './sfx.js'

// System to connect to hand tracking sources. Currently, only Leap Motion hands
// are supported.
//
// Emits `hands-connected` event when hands are connected and initialized
Util.registerComponentSystem('hand-tracking', {
  schema: {
    // Automatically connects to hand sources if true
    autoConnect: {default: true}
  },
  init() {
    this.el.sceneEl.addEventListener('leap-connect', () => {
      if (this.data.autoConnect)
      {
        this.initLeapHands()
      }
    })

    if (this.data.autoConnect && this.el.sceneEl.systems['leap'].isConnected())
    {
      this.initLeapHands()
    }
  },
  initLeapHands() {
    if (this.usingLeapHands) return

    console.log("Initializing Leap Motion Hands")

    for (let hand of ['left', 'right'])
    {
      let el = document.querySelector(`#${hand}-hand`)
      Util.whenLoaded(el, () => {
        el.setAttribute('leap-hand', `hand: ${hand}; pinchButton: pinch`)
        el.setAttribute('hand-helper', `hand: ${hand}`)

        for (let component of ['valve-index-controls', 'oculus-touch-controls', 'vive-controls', 'tracked-controls-webxr', 'tracked-controls-webvr', 'tracked-controls'])
        {
          if (!(component in el.components)) continue
          if (el.components[component].isPlaying) el.components[component].pause()
        }

        el.object3D.position.set(0,0,0)
        el.object3D.rotation.set(0,0,0)
      })
    }

    this.usingLeapHands = true
    this.el.emit('hands-connected', {type: 'leap'})
  }
})

// Creates a button which is triggered by touching it with a hand.
//
// When the user brings a hand close to the button, it will emit a `mouseenter`
// event, allowing it to be easily used with the `tooltip` component (and a
// corresponding `mouseleave` event when the user brings their hand away). When
// triggered, it will emit the `click` event.
AFRAME.registerComponent('hand-touch-button', {
  schema: {
    // Size of cube where `mouseenter` and `mouseleave` events occured
    outerSize: {default: 0.17},
    // Size of cube where clicks occur
    innerSize: {default: 0.1},
    // Color of button
    color: {default: '#abe'},
    // Throttle for checking hand location
    throttle: {default: 50},
    // Icon to overlay
    icon: {type: 'selector'}
  },
  init() {
    let box = document.createElement('a-entity')
    box.setAttribute('geometry', 'primitive: box;')
    box.setAttribute('material', 'shader: matcap; wireframe: true; color: #aea')
    this.el.append(box)
    this.outerBox = box

    let innerBox = document.createElement('a-entity')
    innerBox.setAttribute('geometry', 'primitive: box;')
    innerBox.setAttribute('material', 'shader: matcap; wireframe: false')
    this.innerBox = innerBox
    this.el.append(innerBox)
    Pool.init(this)

    if (this.el.hasAttribute('tooltip') && !this.el.hasAttribute('tooltip-style'))
    {
      Util.whenLoaded(this.el, () => this.el.setAttribute('tooltip-style', 'scale: 0.2 0.2 1.0; offset: 0 -0.3 0'))
    }

    this.tick = AFRAME.utils.throttleTick(this.tick, this.data.throttle, this)
  },
  update(oldData) {
    this.outerBox.setAttribute('geometry', 'width', this.data.outerSize)
    this.outerBox.setAttribute('geometry', 'height', this.data.outerSize)
    this.outerBox.setAttribute('geometry', 'depth', this.data.outerSize)
    this.outerBox.setAttribute('material', 'color', this.data.color)
    Util.whenLoaded(this.outerBox, () => {
      this.outerBox.getObject3D('mesh').geometry.computeBoundingBox()
      this.outerBox.object3D.visible = false
    })

    this.innerBox.setAttribute('geometry', 'width', this.data.innerSize)
    this.innerBox.setAttribute('geometry', 'height', this.data.innerSize)
    this.innerBox.setAttribute('geometry', 'depth', this.data.innerSize)
    this.innerBox.setAttribute('material', 'color', this.data.color)
    Util.whenLoaded(this.innerBox, () => this.innerBox.getObject3D('mesh').geometry.computeBoundingBox())

    if (this.data.icon && !this.iconBox)
    {
      this.iconBox = true
      Util.whenLoaded(this.innerBox, () => {
        this.iconBox = new THREE.Object3D()

        let material = new THREE.MeshBasicMaterial({
          transparent: true,
          color: "#FFF"
        })

        this.iconBox.add(new THREE.Mesh(this.innerBox.getObject3D('mesh').geometry, material))
        this.iconBox.scale.set(1.1, 1.1, 1.1)
        this.iconBox.position.z += 0.01

        material.map = new THREE.Texture()
        material.map.image = this.data.icon
        material.map.needsUpdate = true

        this.innerBox.object3D.add(this.iconBox)
        console.log("Added iconbox", this.iconBox)
      })
    }

  },
  checkIntersection(otherEl) {
    if (!this.el.object3D.visible) return
    let parentVisible = true
    this.el.object3D.traverseAncestors(a => parentVisible = parentVisible && a.visible)
    if (!parentVisible) return false

    let otherPos = this.pool('otherPos', THREE.Vector3)
    otherEl.object3D.getWorldPosition(otherPos)

    this.el.object3D.worldToLocal(otherPos)

    if (this.outerBox.getObject3D('mesh').geometry.boundingBox.containsPoint(otherPos))
    {
      if (!this.hovered)
      {
        this.el.emit('mouseenter')
        this.hovered = true
        this.activeHand = otherEl
        this.el.addState('hovered')
      }
    }
    else
    {
      if (this.hovered)
      {
        console.log("leaving", otherPos, (Math.abs(otherPos.x) < this.data.outerSize
            && Math.abs(otherPos.y) < this.data.outerSize
            && Math.abs(otherPos.z) < this.data.outerSize))
        this.el.emit('mouseleave')
        this.hovered = false
        this.el.removeState('hovered')
      }
    }

    if (this.innerBox.getObject3D('mesh').geometry.boundingBox.containsPoint(otherPos))
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
        console.log("Remove click state")
        this.el.removeState('clicked')
        this.clicked = false
      }
    }

  },
  tick(t,dt) {
    if (this.el.handEl) {
      this.checkIntersection(this.el.handEl)
    }
  }
})

// Creates a context-aware menu which floats above the opposite hand for
// performing tasks such as scaling, pushing, and pulling.
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
    },
    pinchdown: function(e) {
      this.otherHandHelper.showPinchMenu()
    },
    pinchup: function(e) {
      this.otherHandHelper.hidePinchMenu()
    },
    click: function(e) {
      if (!e.target.hasAttribute('click-action')) return
      this[e.target.getAttribute('click-action')](e)

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
      menu.querySelectorAll('*[hand-touch-button]').forEach(el => {
        el.handEl = this.el
        el.otherHandEl = this.otherHandEl
      })
      document.querySelector('#camera-root').object3D.add(menu.object3D)
    })

    let clicker = document.createElement('a-sphere')
    clicker.setAttribute('radius', 0.01)
    this.el.append(clicker)
    Pool.init(this)
  },
  updateMenu() {
    Util.positionObject3DAtTarget(this.menu.object3D, this.el.object3D)
    this.menu.object3D.rotation.set(0,0,0)
    let cameraObject2 =  document.getElementById('camera').getObject3D('camera-matrix-helper')

    let cameraForward = this.pool('cameraForward', THREE.Vector3)
    cameraObject2.getWorldDirection(cameraForward)
    cameraObject2.getWorldDirection(cameraForward)

    cameraForward.y = 0
    cameraForward.normalize()
    this.menu.object3D.matrix.lookAt(cameraForward, this.pool('origin', THREE.Vector3), this.el.sceneEl.object3D.up)
    this.menu.object3D.quaternion.setFromRotationMatrix(this.menu.object3D.matrix)

    this.menu.querySelectorAll('.menu').forEach(el => el.setAttribute('visible', false))
    if (this.gripMenu)
    {
      this.menu.querySelector('.grip-menu').setAttribute('visible', true)
    }
    else if (this.pinchMenu)
    {
      this.menu.querySelector('.pinch-menu').setAttribute('visible', true)
    }
  },
  showGripMenu() {
    this.gripMenu = true
    this.updateMenu()
  },
  hideGripMenu() {
    this.gripMenu = false
    this.updateMenu()
  },
  showPinchMenu() {
    this.pinchMenu = true
    this.updateMenu()
  },
  hidePinchMenu() {
    this.pinchMenu = false
    this.updateMenu()
  },
  hideMenu() {
    this.gripMenu = false
    this.pinchMenu = false
    this.updateMenu()
  },
  click() {
    this.otherHandEl.emit('triggerdown')
    this.otherHandEl.emit('triggerup')
  },
  toggleRotation() {
    if (this.otherHandEl.is('rotating'))
    {
      this.otherHandEl.removeState('rotating')
    }
    else
    {
      this.otherHandEl.addState('rotating')
    }
  }
})

AFRAME.registerComponent('zoom-touch-button', {
  dependencies: ['hand-touch-button'],
  schema: {
    direction: {oneOf: ['out', 'in']}
  },
  init() {
    // AFRAME.utils.throttleTick(this.tick, 45, this)
  },
  events: {
    stateadded: function(e) {
      console.log("stateadded", e.detail)
      if (this.el.is('clicked')) {
        console.log("Zoooming", e.detail)
        let handEl = this.el.components['hand-touch-button'].activeHand
        let otherHandEl = this.el.otherHandEl
        if (!otherHandEl) otherHandEl = document.querySelector(`#${handEl.id === 'right-hand' ? 'left-hand' : 'right-hand'}`)

        switch (this.data.direction)
        {
          case 'in': otherHandEl.components['manipulator'].zoomAmmount = 0.2; break;
          case 'out': otherHandEl.components['manipulator'].zoomAmmount = -0.2; break;
          case 'small': otherHandEl.components['manipulator'].scaleAmmount = 0.2; break;
          case 'big': otherHandEl.components['manipulator'].scaleAmmount = -0.2; break;
        }
      }
    },
    stateremoved: function(e) {
      if (!this.el.is('clicked')) {
        console.log("unZoooming", e.detail)
        let handEl = this.el.components['hand-touch-button'].activeHand
        let otherHandEl = this.el.otherHandEl
        if (!otherHandEl) otherHandEl = document.querySelector(`#${handEl.id === 'right-hand' ? 'left-hand' : 'right-hand'}`)

        switch (this.data.direction)
        {
          case 'in': otherHandEl.components['manipulator'].zoomAmmount = 0; break;
          case 'out': otherHandEl.components['manipulator'].zoomAmmount = 0; break;
          case 'small': otherHandEl.components['manipulator'].scaleAmmount = 0; break;
          case 'big': otherHandEl.components['manipulator'].scaleAmmount = 0; break;
        }
      }
    }
  }
})
