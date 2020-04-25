import {ButtonMaps, JoystickDirections} from './joystick-directions'
import {Sfx} from './sfx.js'

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
        // document.querySelectorAll('*[laser-controls]').forEach(el => el.pause())
      }
    })
  },

  leftClick() {
    document.querySelector('#canvas-view').components.compositor.previousFrame()
  },
  rightClick() {
    document.querySelector('#canvas-view').components.compositor.nextFrame()
  },
  upClick() {
    Sfx.joystick(this.el)
    document.querySelector('#canvas-view').components.compositor.addFrameAfter()
  },
  downClick() {
    Sfx.joystick(this.el)
    document.querySelector('#canvas-view').components.compositor.duplicateFrameAfter()
  }
})
