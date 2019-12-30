AFRAME.registerComponent('left-hand-controls', {
  init() {
    this.dirX = 0;
    this.el.addEventListener('axismove', e => {
      if (this.el.is('grabbing')) return;

      const { detail } = e;
      const { amount } = this.data;
      if ((detail.axis[0] > 0.8) && (this.dirX !== 1)) {
        this.dirX = 1;
        this.rightClick()
      } else if ((-0.8 < detail.axis[0] && detail.axis[0] < 0.8) && (this.dirX !== 0)) {
        return this.dirX = 0;
      } else if ((detail.axis[0] < -0.8) && (this.dirX !== -1)) {
        this.dirX = -1;
        this.leftClick();
      }
    });
  },

  leftClick() {
    this.el.sceneEl.systems['paint-system'].prevBrush()
  },
  rightClick() {
    this.el.sceneEl.systems['paint-system'].nextBrush()
  }
})
