import {JoystickDirections} from './joystick-directions'

AFRAME.registerComponent('left-hand-controls', {
  init() {
    JoystickDirections.install(this)
  },

  leftClick() {
    this.el.sceneEl.systems['paint-system'].prevBrush()
  },
  rightClick() {
    this.el.sceneEl.systems['paint-system'].nextBrush()
  },
  upClick() {
    document.querySelector('#canvas-view').components.compositor.nextLayer()
  },
  downClick() {
    document.querySelector('#canvas-view').components.compositor.prevLayer()
  }
})
