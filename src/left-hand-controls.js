import {ButtonMaps, JoystickDirections} from './joystick-directions'

AFRAME.registerComponent('left-hand-controls', {
  init() {
    JoystickDirections.install(this)
    this.el.setAttribute('smooth-controller', "")
    this.el.setAttribute('manipulator', {selector: '#canvas-view', useRay: true})

    let buttonMap = new ButtonMaps()
    buttonMap.setMap({
      'trackpad': 'sampling'
    })
    buttonMap.setMap({
      'xbutton': buttonMap.toggle('rotating'),
      'trackpad': buttonMap.toggle('rotating')
    }, "grabbing")
    buttonMap.install(this)

    this.el.addEventListener('thumbstickdown', () => {
      this.el.sceneEl.systems['settings-system'].resetCameraAction()
    })

    this.el.addEventListener('menudown', () => {
      this.el.sceneEl.systems['settings-system'].resetCameraAction()
    })

    this.el.addEventListener('xbuttondown', () => {
      if (!this.el.is("grabbing"))
      {
        this.el.sceneEl.systems['settings-system'].undoAction()
      }
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
