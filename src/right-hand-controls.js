AFRAME.registerComponent('joystick-turn', {
  schema: {
    amount: {type: 'number', default: 3.14 / 4},
    target: {type: 'selector'}
  },
  init() {
    this.dirX = 0;
    this.el.addEventListener('axismove', e => {
      if (this.el.is('grabbing')) return;

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
    this.paintSystem = document.querySelector('a-scene').systems['paint-system']
    this.el.setAttribute('joystick-turn', "target: #camera-root")
    this.el.setAttribute('manipulator', {selector: '#canvas-view', useRay: true})

    this.scaleBrushAmmount = 0
    this.el.addEventListener('axismove', e => {
      this.scaleBrushAmmount = e.detail.axis[1]
    })

    this.el.addEventListener('bbuttondown', e => {
      this.el.addState('sampling')
    })

    this.el.addEventListener('bbuttonup', e => {
      this.el.removeState('sampling')
    })

    this.tick = AFRAME.utils.throttleTick(this.tick, 50, this)
  },

  tick(t, dt) {
    if (Math.abs(this.scaleBrushAmmount) > 0.08)
    {
      this.paintSystem.scaleBrush(- dt * this.scaleBrushAmmount)
    }
  }
});
