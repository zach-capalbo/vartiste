import {ButtonMaps, Axes, JoystickDirections} from './joystick-directions.js'
import {Undo} from './undo.js'

AFRAME.registerComponent('right-hand-controls', {
  dependencies: ['raycaster'],
  events: {
    'thumbstickdown': function(e) {
      Undo.redoStack.undo()
    }
  },
  init() {
    this.paintSystem = document.querySelector('a-scene').systems['paint-system']
    // this.el.setAttribute('joystick-turn', "target: #artist-root")
    this.el.setAttribute('manipulator', {selector: '#canvas-view', useRay: true})
    this.el.setAttribute('smooth-controller', "")

    JoystickDirections.install(this)

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
      // 'thumbstick': buttonMap.toggle('orbiting')
    }, "grabbing")

    buttonMap.install(this)

    this.tick = AFRAME.utils.throttleTick(this.tick, 50, this)

    this.el.setAttribute('action-tooltips', 'leftright: Snap Turn; thumbstick: redo')
  },

  tick(t, dt) {
    if (!this.el.is("grabbing") && Math.abs(this.scaleBrushAmmount) > 0.08)
    {
      this.paintSystem.scaleBrush(- dt * this.scaleBrushAmmount)
    }
  },

  leftClick() {
    this.el.sceneEl.systems['artist-root'].rotateLeft()
  },
  rightClick() {
    this.el.sceneEl.systems['artist-root'].rotateRight()
  }
});
