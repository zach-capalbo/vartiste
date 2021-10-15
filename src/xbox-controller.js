import {Util} from './util.js'

const buttonNames = [
            'a',
            'b',
            'x',
            'y',
            'leftTop',
            'rightTop',
            'leftTrigger',
            'rightTrigger',
            'select',
            'start',
            'leftStick',
            'rightStick',
            'dpadUp',
            'dpadDown',
            'dpadLeft',
            'dpadRight',
            'unknown',
        ];

AFRAME.registerComponent('xbox-controller', {
  schema: {
    checkThrottle: {default: 1000},
    throttle: {default: 0},
    index: {default: -1},
  },
  emits: {
    controllerconnected: {
      id: ""
    },
    buttonchanged: {id: 0, state: {}},
    buttondown: {
      id: 0,
      state: {}
    },
    buttonup: {id: 0, state: {}},
    axismove: {},
    'model-loaded': {}
  },
  init() {
    Util.emitsEvents(this);

    this.buttonStates = []
    for (let i = 0; i < buttonNames.length; ++i)
    {
      let lowerCaseName = buttonNames[i].toLowerCase();
      this.buttonStates[i] = {
        name: buttonNames[i],
        pressedEvent: lowerCaseName + 'buttondown',
        releaseEvent: lowerCaseName + 'up',
        pressed: false,
        touched: false,
        value: 0,
      }
    }
  },
  setupGamepad(gamepad) {
    if (!this.gamepad)
    {
      this.emitDetails.controllerconnected.id = gamepad.id
      this.el.emit('controllerconnected', this.emitDetails.controllerconnected)
    }
    this.gamepad = gamepad
    this.checkButtons()
  },
  checkForController() {
    let gamepads = navigator.getGamepads();

    for (let i = 0; i < gamepads.length; ++i)
    {
      let gamepad = gamepads[i];
      if (!gamepad) continue;
      if (/XInput STANDARD GAMEPAD/.test(gamepad.id))
      {
        if (this.data.index > 0 && gamepad.index !== this.data.index) continue;
        if (this.gamepad == gamepad) return;
        this.setupGamepad(gamepad);
      }
    }
  },
  checkButtons() {
    let gamepad = this.gamepad
    for (let i = 0; i < gamepad.buttons.length; ++i)
    {
      let button = gamepad.buttons[i]
      let oldState = this.buttonStates[i]
      let changed = false
      if (button.pressed !== oldState.pressed)
      {
        oldState.pressed = button.pressed
        let detail = button.pressed ? this.emitDetails.buttonpressed : this.emitDetails.buttonup
        let event = button.pressed ? 'buttonpressed' : 'buttonup'
        detail.id = i
        detail.state = oldState
        changed = true
        this.el.emit(event, detail, false)
        this.el.emit(button.pressed ? oldState.pressedEvent : oldState.releaseEvent, detail, false)
      }

      if (button.value !== oldState.value)
      {
        oldState.value = button.value
        let detail = this.emitDetails.buttonchanged
        detail.id = i
        detail.state = oldState
        this.el.emit('buttonchanged', detail, false)
      }
    }
  },
  tick(t, dt) {

  }
})
