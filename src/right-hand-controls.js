AFRAME.registerComponent('joystick-turn', {
  schema: {
    amount: {type: 'number', default: 3.14 / 4},
    target: {type: 'selector'}
  },
  init() {
    this.dirX = 0;
    this.el.addEventListener('axismove', e => {
      const { detail } = e;
      const { amount } = this.data;
      if ((detail.axis[0] > 0.8) && (this.dirX !== 1)) {
        this.dirX = 1;
        return this.data.target.object3D.rotation.y -= amount;
      } else if ((-0.8 < detail.axis[0] && detail.axis[0] < 0.8) && (this.dirX !== 0)) {
        return this.dirX = 0;
      } else if ((detail.axis[0] < -0.8) && (this.dirX !== -1)) {
        this.dirX = -1;
        return this.data.target.object3D.rotation.y += amount;
      }
    });
  }
}
);


AFRAME.registerComponent('right-hand-controls', {
  dependencies: ['raycaster', 'laser-controls'],
  init() {
    this.el.setAttribute('joystick-turn', "target: #camera-root")
  }
});
