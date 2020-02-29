AFRAME.registerComponent('canvas-updater', {
  dependencies: ['geometry', 'material'],
  schema: {
    throttle: {type: 'int', default: 300}
  },

  init() {
    this._tick = this.tick
    if (this.data.throttle > 0)
    {
      this.tick = AFRAME.utils.throttleTick(this.tick, this.data.throttle + Math.random() * 100, this)
    }
  },

  tick(t, dt) {
    var el = this.el;
    var material;

    let parentVisible = true
    this.el.getObject3D('mesh').traverseAncestors(a => parentVisible = parentVisible && a.visible)
    if (!parentVisible) return false

    material = el.getObject3D('mesh').material;
    if (!material.map) { return; }
    if (material.map.image.getUpdateTime && material.map.image.getUpdateTime() < this.drawnT) return
    material.map.needsUpdate = true;
    this.drawnT = t
  }
});
