import {JoystickDirections} from './joystick-directions'

AFRAME.registerComponent('left-hand-controls', {
  init() {
    JoystickDirections.install(this)

    let buttonMap = {
      'trackpad': 'sampling',
    }

    for (let button in buttonMap) {
      let state = buttonMap[button]
      this.el.addEventListener(button + 'down', e => {
        this.el.addState(state)
      })

      this.el.addEventListener(button + 'up', e => {
        this.el.removeState(state)
      })
    }

    this.el.addEventListener('thumbstickdown', () => {
      this.el.sceneEl.systems['settings-system'].resetCameraAction()
    })

    this.el.addEventListener('menudown', () => {
      this.el.sceneEl.systems['settings-system'].resetCameraAction()
    })
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
