AFRAME.registerComponent('canvas-updater', {
  dependencies: ['geometry', 'material'],
  schema: {
    throttle: {type: 'int', default: 300}
  },

  init() {
    this._tick = this.tick
    if (this.data.throttle > 0)
    {
      this.tick = AFRAME.utils.throttleTick(this.tick, this.data.throttle, this)
    }
  },

  tick() {
    var el = this.el;
    var material;

    material = el.getObject3D('mesh').material;
    if (!material.map) { return; }
    material.map.needsUpdate = true;
  }
});
