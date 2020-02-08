AFRAME.registerComponent('mobile-camera', {
  dependencies: ["look-controls"],
  init() {
    if (!this.el.sceneEl.isMobile) return

    this.el.setAttribute('look-controls', {touchEnabled: false})
  }
})
