import {Util} from './util.js'
// Sets the speed of WASD movement in desktop mode.
AFRAME.registerComponent('desktop-controls', {
  dependencies: ['wasd-controls', 'look-controls'],
  schema: {
    // Sets the distance moved for one keystroke, in world units.
    velocity: {default: 0.001}
>>>>>>> Updated description of desktop-controls and its property. Made some assumptions here, so please correct if incorrect (which is highly likely).
  },
  init() {
    this.el.setAttribute('wasd-controls', 'wsInverted: false; fly: true; acceleration: 1')
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

    this.el.sceneEl.addEventListener('enter-vr', () => {
      document.querySelectorAll('.hidden-in-vr').forEach(el => el.classList.add('hidden'))
    })

    this.el.sceneEl.addEventListener('exit-vr', () => {
      document.querySelector('.desktop-controls').classList.remove('hidden')
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
      if (!this.previousMouseEvent || this.previousMouseEvent instanceof MouseEvent) this.previousMouseEvent = {};
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
    document.querySelector('#mouse').removeState('sampling')
  },
  grab() {
    document.querySelector('#camera-root').addState('looking')
    document.querySelector('#mouse').addState('looking')
    document.querySelector('#mouse').addState('grabmode')
  },
  sample() {
    document.querySelector('#mouse').addState('sampling')

    document.querySelector('#camera-root').removeState('looking')
    document.querySelector('#mouse').removeState('looking')
    document.querySelector('#mouse').removeState('grabmode')
  },
  rotateLeft() {
    this.el.sceneEl.systems['artist-root'].rotateLeft()
  },
  rotateRight() {
    this.el.sceneEl.systems['artist-root'].rotateRight()
  }
})

AFRAME.registerComponent('desktop-button-caster', {
  dependencies: ['button-caster'],
  schema: {
    castableButtons: {default: ['a','b', 'x', 'y']}
  },
  init() {
    document.addEventListener('keydown', e => {
      let key = e.key.toLowerCase()
      if (this.data.castableButtons.includes(key)) {
        this.el.emit(`${key}buttondown`, {})
      }
    })

    document.addEventListener('keyup', e => {
      let key = e.key.toLowerCase()
      if (this.data.castableButtons.includes(key)) {
        this.el.emit(`${key}buttonup`, {})
      }
    })
  }
})
