import {Util} from './util.js'

const Axes = {
  LEFT_RIGHT: 0,
  UP_DOWN: 1,
  up_down(el) {
    if (el.hasAttribute('webxr-motion-controller')) return this.UP_DOWN;
    let offset = (el.components['tracked-controls'].axis.length === 4) ? 2 : 0
    return this.UP_DOWN + offset;
  },
  left_right(el) {
    if (el.hasAttribute('webxr-motion-controller')) return this.LEFT_RIGHT;
    let offset = (el.components['tracked-controls'].axis.length === 4) ? 2 : 0
    return this.LEFT_RIGHT + offset;
  }
}

// A class for easily adding joystick direction handling as "clickable" buttons
// Install on a component with `VARTISTE.JoystickDirections.install(this)` in
// the component's `init` method, and then attach that component to an entity
// with tracked controls. Then that component have it's `leftClick`,
// `rightClick`, `upClick`, and `downClick` functions called when the user
// clicks the joystick in those directions. Note that this is a discrete
// "Click", not a continuous movement kind of thing.
class JoystickDirectionHandler {
  constructor(where, {targetEl, whenGrabbing = false} = {}) {
    this.dirX = 0;
    this.dirY = 0;

    if (targetEl === undefined) targetEl = where.el

    this.rightClick = this.leftClick = this.upClick = this.downClick = function() {}

    this.handleX = false
    this.handleY = false

    for (let dir of ['leftClick', 'rightClick']) {
      if (dir in where) {
        this[dir] = where[dir].bind(where)
        this.handleX = true
      }
    }

    for (let dir of ['upClick', 'downClick']) {
      if (dir in where) {
        this[dir] = where[dir].bind(where)
        this.handleY = true
      }
    }

    if (!(this.handleX || this.handleY)) return;

    targetEl.addEventListener('axismove', e => {
      if (targetEl.is('grabbing') && !whenGrabbing) return;

      const { detail } = e;

      if (this.handleX)
      {
        if ((detail.axis[Axes.left_right(targetEl)] > 0.8) && (this.dirX !== 1)) {
          this.dirX = 1;
          this.rightClick(detail)
        } else if ((-0.8 < detail.axis[Axes.left_right(targetEl)] && detail.axis[Axes.left_right(targetEl)] < 0.8) && (this.dirX !== 0)) {
          return this.dirX = 0;
        } else if ((detail.axis[Axes.left_right(targetEl)] < -0.8) && (this.dirX !== -1)) {
          this.dirX = -1;
          this.leftClick(detail);
        }
      }

      if (this.handleY)
      {
        if ((detail.axis[Axes.up_down(targetEl)] > 0.8) && (this.dirY !== 1)) {
          console.log("Clicking up", detail.axis[Axes.up_down(targetEl)], this.dirY)
          this.dirY = 1;
          this.upClick(detail)
        } else if ((-0.8 < detail.axis[Axes.up_down(targetEl)] && detail.axis[Axes.up_down(targetEl)] < 0.8) && (this.dirY !== 0)) {
          console.log("Clicking reset", detail.axis[Axes.up_down(targetEl)], this.dirY)
          return this.dirY = 0;
        } else if ((detail.axis[Axes.up_down(targetEl)] < -0.8) && (this.dirY !== -1)) {
          console.log("Clicking down", detail.axis[Axes.up_down(targetEl)], this.dirY)
          this.dirY = -1;
          this.downClick(detail);
        }
      }
    });
  }
}

// Allows easy setting of tracked controller entity states when buttons are
// pressed.
class ButtonMaps {
  constructor() {
    this.maps = {}
    this.buttons = []
  }
  toggle(state) {
    return {state, toggle: true}
  }
  setMap(map, preState = "") {
    this.maps[preState] = map
    this.buttons = this.buttons.concat(Object.keys(map))
  }
  install(where) {
    // console.log("Buttons", this.buttons, where)

    let buttonsToInstall = new Set(this.buttons)

    let eventTarget
    if (where.el.hasAttribute('button-caster')) {
      eventTarget = where.el
    }
    else {
      eventTarget = where.el.sceneEl
      where.el.sceneEl.systems['button-caster'].install(buttonsToInstall)
    }

    for (let button of buttonsToInstall)
    {
      console.log("Installing", button)
      eventTarget.addEventListener(button + 'down', e => {
        for (let preState of Object.keys(this.maps))
        {
          if (preState === "") continue
          if (where.el.is(preState) && button in this.maps[preState])
          {
            let state = this.maps[preState][button]
            let toggle = state.toggle
            if (typeof state === 'object') state = state.state
            if (toggle && where.el.is(state))
            {
              where.el.removeState(state)
              return
            }

            where.el.addState(state)
            return
          }
        }

        if (this.maps[""] && this.maps[""][button]) where.el.addState(this.maps[""][button])
      })

      where.el.addEventListener(button + 'up', e => {
        for (let preState of Object.keys(this.maps))
        {
          let state = this.maps[preState][button]
          if (!state) return
          let toggle = state.toggle
          if (typeof state === 'object') state = state.state

          if (toggle) return
          where.el.removeState(this.maps[preState][button])
        }
      })
    }
  }
}

const JoystickDirections = {
  install(where, opts) {
    new JoystickDirectionHandler(where, opts)
  }
}

// Turns the target element by the specified amount when the user
// presses the joystick left or right. Also known as snap turning.
AFRAME.registerComponent('joystick-turn', {
  schema: {
    // The angle of the turn expressed as a number in radians, where 3.14 is one full turn
    // e.g. 3.14 / 4 for a quarter turn, 3.14 / 2 for a half turn
    amount: {type: 'number', default: 3.14 / 4},
    // The target element
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

// Place on a component so that when it is hovered, it will display on the
// approriate actions on the hovering hand (via the
// [`hand-action-tooltip`](#hand-action-tooltip))
//
// If you set a single `action-tooltips` attribute, the same actions will
// display on either hand. You can set individual `action-tooltips__right-hand`
// and `action-tooltips__left-hand` to display different tooltips for different
// hands.
AFRAME.registerComponent('action-tooltips', {
  multiple: true,
  schema: {
    // Label for what you're pointing at. Can be used where a tooltip will get in the way
    label: {type: 'string', default: null, parse: (o) => o},

    // Tooltip for moving the joystick up and down
    updown: {type: 'string', default: null, parse: (o) => o},

    // Tooltip for moving the joystick left and right
    leftright: {type: 'string', default: null, parse: (o) => o},

    // Tooltip for pressing the "a" button or equivalent
    a: {type: 'string', default: null, parse: (o) => o},

    // Tooltip for pressing the "b" button or equivalent
    b: {type: 'string', default: null, parse: (o) => o},

    // Tooltip for pulling the trigger or equivalent
    trigger: {type: 'string', default: null, parse: (o) => o},

    // Tooltip for squeezing the grip or equivalent
    grip: {type: 'string', default: null, parse: (o) => o},

    // Tooltip for pressing the thumbstick or trackpad
    thumbstick: {type: 'string', default: null, parse: (o) => o},

    // Shelf to refer to for more options
    shelf: {type: 'string', default: null, parse: (o) => o},
  }
})

// Component attached to each hand that displays the [`action-tooltips`](#action-tooltips).
//
// _Note: Using the [`vartiste-user-root`](#vartiste-user-root) component automatically attaches these to controllers.
AFRAME.registerComponent('hand-action-tooltip', {
  dependencies: ['raycaster', 'action-tooltips'],
  schema: {
    // The time between updates to tooltip text, in milliseconds.
    throttle: {default: 150},
    // The displacement of the display component from the hand in three dimensions, as a vec3.
    position: {type: 'vec3', default: new THREE.Vector3(-0.006549004823841076, -0.11940164556557662, 0.10084264804121343)}
  },
  init() {
    let container = document.createElement('a-entity')
    container.setAttribute('geometry', 'primitive: plane; height: 0; width: 0')
    container.setAttribute('material', 'color: #abe; shader: flat')
    container.setAttribute('position', this.data.position)
    container.setAttribute('rotation', "-47.22767925743924 -1.2047588819680946 -2.40270564492676")
    container.setAttribute('scale', '0.15 0.15 0.15')
    container.setAttribute('text', `color: #000; width: 1; align: left; value: ...; wrapCount: 20; baseline: top`)
    this.el.append(container)
    this.container = container
    this.tick = AFRAME.utils.throttleTick(this.tick, this.data.throttle, this)

    this.buttons = [
      'label',
      'trigger',
      'updown',
      'leftright',
      'a',
      'b',
      'grip',
      'thumbstick'
    ]

    this.names = {
      'label': "",
      'updown': "Up/Down",
      'leftright': "Left/Right",
      'a': "A",
      'b': "B",
      'trigger': "Trigger",
      'grip': "Grip",
      'thumbstick': "Thumbstick",
    }

    this.message = {}
    this.messageString = []

    for (let b of this.buttons) this.message[b] = null

    this.lastMessage = Object.assign({}, this.message)

    this.thisTooltipAttr = "action-tooltips__" + this.el.id
  },
  setMessage()
  {
    Object.assign(this.message, this.el.getAttribute('action-tooltips'))

    if (this.el.components.raycaster.intersectedEls.length == 0)
    {
      return
    }

    let targetEl = this.el.components.raycaster.intersectedEls[0]

    while (targetEl)
    {
      let targetActions = targetEl.getAttribute(this.thisTooltipAttr) || targetEl.getAttribute('action-tooltips') || targetEl.actionTooltips

      if (targetActions)
      {
        for (let k in targetActions)
        {
          if (this.message[k] === null)
          {
            this.message[k] = targetActions[k]
          }
        }
      }

      targetEl = targetEl['redirect-grab']
    }


    if (this.el.is('grabbing'))
    {
      this.message.updown = "Push / Pull"
      this.message.leftright = "Smaller / Bigger"
      this.message.a = this.el.is("rotating") ? "Lock Rotation" : "Unlock Rotation"
    }
    else
    {
      this.message.grip = "Grab"
    }
  },
  tick(t, dt)
  {
    if (!this.el.getObject3D('mesh')) return
    this.setMessage()
    let allSame = true
    for (let k in this.message) {
      if (this.message[k] !== this.lastMessage[k])
      {
        allSame = false
        break
      }
    }

    if (allSame) return

    let messageString = this.messageString
    let i = 0
    for (let k of this.buttons)
    {
      if (this.message[k] !== null)
      {
        if (this.names[k].length > 0)
        {
          messageString[i++]= `> ${this.names[k]}: ${this.message[k]}`
        }
        else
        {
          messageString[i++]= `${this.message[k]}`
        }
      }
    }

    messageString.length = i

    Object.assign(this.lastMessage, this.message)

    this.container.getObject3D('mesh').visible = messageString.length > 0
    this.container.setAttribute('geometry', 'width', 0)
    this.container.setAttribute('geometry', 'height', 0)
    this.container.setAttribute('text', 'value', messageString.join("\n"))
    this.container.getObject3D('mesh').position.y = - this.container.getAttribute('geometry').height * 0.8 / 2
    this.container.getObject3D('mesh').scale.set(1.2, 1.2, 1.2)
  }
})

class ButtonRepeatHandler {
  constructor(el, button) {
    this.el = el
    this.button = button
    this.down = this.down.bind(this)
    this.up = this.up.bind(this)
    this.pressed = false
    el.addEventListener(`${button}down`, this.down)
    el.addEventListener(`${button}up`, this.up)
  }
  down(e) {
    console.log("Starting repeat for", this.button, this.el)
    this.startTime = el.sceneEl.time
    this.pressed = true
  }
  up(e) {
    console.log("Ending repeat for", this.button, this.el)
    this.startTime = undefined
    this.pressed = false
  }
}

AFRAME.registerSystem('button-repeater', {
  init() {
    this.buttonHandlers = new Map()
  },
  install(el, buttons) {
    if (!this.buttonHandlers.has(el))
    {
      this.buttonHandlers.set(el, new Map())
    }

    let elHandlers = this.buttonHandlers.get(el)

    for (let button of buttons)
    {
      if (elHandlers.has(button))
      {
        continue;
      }

      elHandlers.set(el, new ButtonRepeatHandler(el, button))
    }
  },
  tick(t, dt) {

  }
})

AFRAME.registerComponent('button-repeater', {
  schema: {
    a: {default: false},
    b: {default: false},
    x: {default: false},
    y: {default: false},
    trigger: {default: false},
    grip: {default: false},
    timeout: {default: 300},
    interval: {default: 100},
  },
  events: {
    abuttondown: function(e) { this.onDown('abutton', e)},
    bbuttondown: function(e) { this.onDown('bbutton', e)},
    xbuttondown: function(e) { this.onDown('xbutton', e)},
    ybuttondown: function(e) { this.onDown('ybutton', e)},
    triggerdown: function(e) { this.onDown('trigger', e)},
    gripdown: function(e) { this.onDown('grip', e)},

    abuttonup: function(e) { this.onUp('abutton', e)},
    bbuttonup: function(e) { this.onUp('bbutton', e)},
    xbuttonup: function(e) { this.onUp('xbutton', e)},
    ybuttonup: function(e) { this.onUp('ybutton', e)},
    triggerup: function(e) { this.onUp('trigger', e)},
    gripup: function(e) { this.onUp('grip', e)},
  },
  init() {
    this.buttonStartTimes = {}
    this.el.sceneEl.systems['button-caster'].install(['b'])
    this.repeatDetail = {isRepeat: true}
  },
  onDown(button, e) {
    if (e.detail.isRepeat) return;
    // console.log("Button down", button, e)

    this.buttonStartTimes[button] = this.el.sceneEl.time
  },
  onUp(button, e) {
    if (e.detail.isRepeat) return;
    // console.log("Button real up", button, e)

    delete this.buttonStartTimes[button]
  },
  tick(t,dt) {
    for (let [button, time] of Object.entries(this.buttonStartTimes))
    {
      if (t - time > this.data.timeout)
      {
        // console.log("Repeating", button)
        this.el.emit(`${button}down`, this.repeatDetail)
        this.el.emit(`${button}up`, this.repeatDetail)
        this.buttonStartTimes[button] = t + this.data.interval - this.data.timeout
      }
    }
  }
})

export { JoystickDirections, ButtonMaps, Axes }
