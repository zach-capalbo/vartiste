AFRAME.registerComponent("popup-shelf", {
  init() {
    this.el.setAttribute('position', "0 -999999 0")
    this.el.sceneEl.addEventListener('open-popup', (e) => {
      this.el.setAttribute('visible', true)
      this.el.setAttribute('position', "0 0 0")
      this.tick = this._tick
      for (let el of document.querySelectorAll('*[raycaster]'))
      {
        el.components.raycaster.refreshObjects()
      }
    })

    this.el.querySelector('.ok').addEventListener('click', (e) => {
      this.el.setAttribute('visible', false)
      this.el.setAttribute('position', "0 -999999 0")
      this.tick = function() {}
      for (let el of document.querySelectorAll('*[raycaster]'))
      {
        el.components.raycaster.refreshObjects()
      }
    })

    this.el.querySelector('*[text]').setAttribute('text', {
      value: `Attempted to open a popup window. Please take off the headset and check your browser. You may have to disable your popup blocker.`
    })

    this.desiredPosition = new THREE.Vector3()
    this.desiredPosition.copy(this.el.object3D.position)

    this.shelf = this.el.querySelector('*[shelf]')

    this._tick = this.tick.bind(this)

    this.tick = function() {}
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
