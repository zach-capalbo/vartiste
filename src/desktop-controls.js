AFRAME.registerComponent('desktop-controls', {
  dependencies: ['wasd-controls', 'look-controls'],
  schema: {
    velocity: {default: 0.001}
  },
  init() {
    this.el.setAttribute('wasd-controls', 'wsInverted: false; fly: true')
    this.el.setAttribute('look-controls', 'touchEnabled: false')
    this.el.setAttribute('position', '0 1.4 0.9')

    this.setupLookControls()

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
  setupLookControls() {
    this.el.sceneEl.canvas.removeEventListener('mousedown', this.el.components['look-controls'].onMouseDown)
    document.body.oncontextmenu = (e) => false
    this.el.components['look-controls'].onMouseDown = (function (evt) {
      var sceneEl = this.el.sceneEl;
      if (!this.data.enabled || (sceneEl.is('vr-mode') && sceneEl.checkHeadsetConnected())) { return; }
      // Handle only not primary button.
      if (evt.button == 0 && !evt.shiftKey) { return; }

      var canvasEl = sceneEl && sceneEl.canvas;

      this.mouseDown = true;
      this.previousMouseEvent = evt;
      this.showGrabbingCursor();

      if (this.data.pointerLockEnabled && !this.pointerLocked) {
        if (canvasEl.requestPointerLock) {
          canvasEl.requestPointerLock();
        } else if (canvasEl.mozRequestPointerLock) {
          canvasEl.mozRequestPointerLock();
        }
      }
      return false
    }).bind(this.el.components['look-controls'])
    this.el.sceneEl.canvas.addEventListener('mousedown', this.el.components['look-controls'].onMouseDown)
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

  }
})
