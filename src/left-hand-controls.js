import {ButtonMaps, JoystickDirections} from './joystick-directions'
import {Sfx} from './sfx.js'

AFRAME.registerComponent('left-hand-controls', {
  schema: {
    enableSpeech: {default: false}
  },
  init() {
    JoystickDirections.install(this)
    this.el.setAttribute('smooth-controller', "")
    this.el.setAttribute('manipulator', {selector: '#canvas-view', useRay: true})

    let buttonMap = new ButtonMaps()
    buttonMap.setMap({
      'trackpad': 'sampling',
    })
    buttonMap.setMap({
      'xbutton': buttonMap.toggle('rotating'),
      'abutton': buttonMap.toggle('rotating'),
      // 'trackpad': buttonMap.toggle('rotating')
    }, "grabbing")
    buttonMap.install(this)

    this.el.addEventListener('thumbstickdown', () => {
      this.el.sceneEl.systems['artist-root'].resetCameraLocation()
    })

    this.el.addEventListener('menudown', () => {
      this.el.sceneEl.systems['artist-root'].resetCameraLocation()
    })

    this.el.addEventListener('xbuttondown', () => {
      if (!this.el.is("grabbing"))
      {
        this.el.sceneEl.systems['settings-system'].undoAction()
        // document.querySelectorAll('*[laser-controls]').forEach(el => el.pause())
      }
    })

    this.el.addEventListener('abuttondown', () => {
      if (!this.el.is("grabbing"))
      {
        this.el.sceneEl.systems['settings-system'].undoAction()
        // document.querySelectorAll('*[laser-controls]').forEach(el => el.pause())
      }
    })

    this.el.addEventListener('ybuttondown', () => {
      if (!this.el.is("grabbing"))
      {
        if (this.data.enableSpeech && this.el.sceneEl.systems['speech'].recognition)
        {
          this.el.sceneEl.systems['speech'].listen()
        }
        else
        {
          this.el.sceneEl.systems['settings-system'].toggleUIAction()
        }
      }
    })

    this.el.setAttribute('action-tooltips', `thumbstick: Reset Orientation; leftright: Prev / Next Frame; updown: Play-pause / Jump to start; a: Undo; b: ${this.el.sceneEl.systems['speech'].recognition ? "Voice Commands" : "Toggle UI"}`)
  },

  leftClick() {
    Sfx.joystick(this.el)
    document.querySelector('#canvas-view').components.compositor.previousFrame()
  },
  rightClick() {
    Sfx.joystick(this.el)
    document.querySelector('#canvas-view').components.compositor.nextFrame()
  },
  upClick() {
    Sfx.joystick(this.el)
    Compositor.component.jumpToFrame(0)
    // document.querySelector('#canvas-view').components.compositor.addFrameAfter()
  },
  downClick() {
    Sfx.joystick(this.el)
    Compositor.component.setIsPlayingAnimation(!Compositor.component.isPlayingAnimation)

    // document.querySelector('#canvas-view').components.compositor.duplicateFrameAfter()
  }
})
