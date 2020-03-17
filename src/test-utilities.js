AFRAME.registerComponent('test-load-confirmation', {
  init() {
    this.startTime = this.el.sceneEl.time
  },
  tick(t, dt) {
    if (t - this.startTime > 100) {
      window.passedLoadTest = true
      this.el.emit('passedloadtest')
      this.tick = function() {}
      this.el.parentEl.removeChild(this.el)
    }
  }
})
