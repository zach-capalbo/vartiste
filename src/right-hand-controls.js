import {ButtonMaps, Axes} from './joystick-directions.js'

AFRAME.registerComponent('joystick-turn', {
  schema: {
    amount: {type: 'number', default: 3.14 / 4},
    target: {type: 'selector'}
  },
  init() {
    let joystickXAxis = Axes.LEFT_RIGHT
    let joystickYAxis = Axes.UP_DOWN
    this.dirX = 0;
    this.el.setAttribute('smooth-controller', "")
    this.el.addEventListener('axismove', e => {
      if (this.el.is('grabbing')) return;

      const { detail } = e;
      const { amount } = this.data;
      if ((detail.axis[joystickXAxis] > 0.8) && (this.dirX !== 1)) {
        this.dirX = 1;
        return this.data.target.object3D.rotation.y -= amount;
      } else if ((-0.8 < detail.axis[joystickXAxis] && detail.axis[joystickXAxis] < 0.8) && (this.dirX !== 0)) {
        return this.dirX = 0;
      } else if ((detail.axis[joystickXAxis] < -0.8) && (this.dirX !== -1)) {
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
      this.scaleBrushAmmount = e.detail.axis[Axes.UP_DOWN]
    })

    let buttonMap = new ButtonMaps()

    buttonMap.setMap({
      'bbutton': 'sampling',
      'abutton': 'erasing',
      'trackpad': 'erasing',
    })

    buttonMap.setMap({
      'abutton': buttonMap.toggle('rotating'),
      'trackpad': buttonMap.toggle('rotating'),
      'thumbstick': buttonMap.toggle('orbiting')
    }, "grabbing")

    buttonMap.install(this)

    this.tick = AFRAME.utils.throttleTick(this.tick, 50, this)
  },

  tick(t, dt) {
    if (Math.abs(this.scaleBrushAmmount) > 0.08)
    {
      this.paintSystem.scaleBrush(- dt * this.scaleBrushAmmount)
    }
  }
});
