AFRAME.registerComponent("popup-shelf", {
  init() {
    this.el.sceneEl.addEventListener('open-popup', (e) => {
      this.el.setAttribute('visible', true)
      this.tick = this._tick
    })

    this.el.querySelector('.ok').addEventListener('click', (e) => {
      this.el.setAttribute('visible', false)
      this.tick = function() {}
    })

    this.el.querySelector('*[text]').setAttribute('text', {
      value: `We've attempted to open a popup. Please take off the headset and check your browser.`
    })

    this.desiredPosition = new THREE.Vector3()
    this.desiredPosition.copy(this.el.object3D.position)

    this.shelf = this.el.querySelector('*[shelf]')

    this._tick = this.tick.bind(this)

    // this.tick = function() {}
  },

  tick(t,dt) {
    let camera = document.querySelector('*[camera]').object3D
    camera.getWorldPosition(this.el.object3D.position)
    // camera.attach(this.el.object3D)
    this.shelf.object3D.position.copy(this.desiredPosition)
    // camera.localToWorld(this.shelf.object3D.position)

    // this.el.object3D.quaternion.copy(camera.quaternion)
    camera.parent.getWorldQuaternion(this.el.object3D.quaternion)
    this.el.object3D.quaternion.multiply(camera.quaternion)
    // camera.getWorldQuaternion(this.el.object3D.quaternion)
    // this.el.object3D.quaternion.

  }
})
