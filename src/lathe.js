AFRAME.registerComponent('lathe', {
  schema: {
    speed: {default: 1.0},
    enabled: {default: true},
    rotationAxis: {type: 'vec3', default: '0 1 0'}
  },
  init() {
  },
  tick(t, dt) {
    if (!this.data.enabled) return
    this.el.object3D.rotateOnWorldAxis(this.data.rotationAxis, dt / 1000.0 * this.data.speed)
  }
})
