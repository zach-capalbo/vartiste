import {Util} from './util.js'
AFRAME.registerComponent('desktop-controls', {
  dependencies: ['wasd-controls', 'look-controls'],
  schema: {
    velocity: {default: 0.001}
  },
  init() {
    this.el.setAttribute('wasd-controls', 'wsInverted: false; fly: true; acceleration: 0.3')
    // this.el.setAttribute('look-controls', 'touchEnabled: false')
    this.el.setAttribute('position', {x: 0.0130435652091113, y: 1.0412983252490486, z: 0.6600262848245867})

    let lookControlsEl = this.el.hasAttribute('look-controls') ? this.el : this.el.querySelector('*[look-controls]')
    Util.whenLoaded([lookControlsEl], () => {
      this.setupLookControls(lookControlsEl)
    })

    this.keys = {q: false, e: false}
    document.addEventListener('keydown', e => {
      if (e.key in this.keys)
      {
        this.keys[e.key] = true
      }
    })

    document.addEventListener('keyup', e => {
      if (e.key in this.keys)
      {
        this.keys[e.key] = false
      }
    })
  },
  setupLookControls(el){
    // console.log("Settting up look controls", el)
    this.el.sceneEl.canvas.removeEventListener('mousedown', el.components['look-controls'].onMouseDown)

    document.body.oncontextmenu = (e) => false

    let shouldLook = (evt) => {
      var sceneEl = this.el.sceneEl;
      if (!el.components['look-controls'].data.enabled || (sceneEl.is('vr-mode') && sceneEl.checkHeadsetConnected())) { return (console.log("vr mode"), false) }
      if (this.el.is('looking')) return true

      // Handle only not primary button.
      if (evt.button == 0 && !evt.shiftKey) { return false; }

      return true
    }

    el.components['look-controls'].onMouseDown = (function (evt) {
      // console.log("new mouse down", shouldLook(evt))
      var sceneEl = this.el.sceneEl;

      if (!shouldLook(evt)) return

      var canvasEl = sceneEl && sceneEl.canvas;

      this.mouseDown = true;
      this.previousMouseEvent.screenX = evt.screenX;
      this.previousMouseEvent.screenY = evt.screenY;
      this.showGrabbingCursor();

      if (this.data.pointerLockEnabled && !this.pointerLocked) {
        if (canvasEl.requestPointerLock) {
          canvasEl.requestPointerLock();
        } else if (canvasEl.mozRequestPointerLock) {
          canvasEl.mozRequestPointerLock();
        }
      }
      return false
    }).bind(el.components['look-controls'])
    this.el.sceneEl.canvas.addEventListener('mousedown', el.components['look-controls'].onMouseDown)
  },
  tick(t, dt) {
    if (this.keys.q) {
      this.el.object3D.position.y += this.data.velocity * dt
    }
    if (this.keys.e) {
      this.el.object3D.position.y -= this.data.velocity * dt
    }
  }
})

AFRAME.registerSystem('desktop-controls', {
  init() {
    document.querySelectorAll('.desktop-controls *[icon-button]').forEach(button => {
      let icon = document.querySelector(button.getAttribute('icon-button')).cloneNode()
      icon.setAttribute('alt', button.getAttribute('tooltip'))
      icon.setAttribute('title', button.getAttribute('tooltip'))
      button.append(icon)
      button.setAttribute('href', '#')

      button.addEventListener('click', () => {
        this[button.getAttribute('click-action')]()
      })
    })
  },
  rotateCamera() {
    document.querySelector('#camera-root').addState('looking')
    document.querySelector('#mouse').addState('looking')
    document.querySelector('#mouse').removeState('grabmode')
  },
  draw() {
    document.querySelector('#camera-root').removeState('looking')
    document.querySelector('#mouse').removeState('looking')
    document.querySelector('#mouse').removeState('grabmode')
  },
  grab() {
    document.querySelector('#camera-root').addState('looking')
    document.querySelector('#mouse').addState('looking')
    document.querySelector('#mouse').addState('grabmode')
  },
  rotateLeft() {
    this.el.sceneEl.systems['artist-root'].rotateLeft()
  },
  rotateRight() {
    this.el.sceneEl.systems['artist-root'].rotateRight()
  }
})
