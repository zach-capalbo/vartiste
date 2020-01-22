import {ButtonMaps, Axes, JoystickDirections} from './joystick-directions.js'

AFRAME.registerComponent('joystick-turn', {
  schema: {
    amount: {type: 'number', default: 3.14 / 4},
    target: {type: 'selector'}
  },
  init() {
    JoystickDirections.install(this)
  },
  leftClick() {
    const { amount } = this.data;
    this.data.target.object3D.rotation.y += amount;
  },
  rightClick() {
    const { amount } = this.data;
    this.data.target.object3D.rotation.y -= amount;
  }
}
);


AFRAME.registerComponent('right-hand-controls', {
  dependencies: ['raycaster', 'laser-controls'],
  init() {
    this.paintSystem = document.querySelector('a-scene').systems['paint-system']
    this.el.setAttribute('joystick-turn', "target: #camera-root")
    this.el.setAttribute('manipulator', {selector: '#canvas-view', useRay: true})
    this.el.setAttribute('smooth-controller', "")

    this.scaleBrushAmmount = 0
    this.el.addEventListener('axismove', e => {
      this.scaleBrushAmmount = e.detail.axis[Axes.up_down(this.el)]
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
