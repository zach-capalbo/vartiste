const Axes = {
  LEFT_RIGHT: 0,
  UP_DOWN: 1,
  up_down(el) {
    let offset = (el.components['tracked-controls'].axis.length === 4) ? 2 : 0
    return this.UP_DOWN + offset;
  },
  left_right(el) {
    let offset = (el.components['tracked-controls'].axis.length === 4) ? 2 : 0
    return this.LEFT_RIGHT + offset;
  }
}

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
    console.log("Buttons", this.buttons, where)

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

        where.el.addState(this.maps[""][button])
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
    // Tooltip for moving the joystick up and down
    'updown': {type: 'string', default: null},

    // Tooltip for moving the joystick left and right
    'leftright': {type: 'string', default: null},

    // Tooltip for pressing the "a" button or equivalent
    'a': {type: 'string', default: null},

    // Tooltip for pressing the "b" button or equivalent
    'b': {type: 'string', default: null},

    // Tooltip for pulling the trigger or equivalent
    'trigger': {type: 'string', default: null},

    // Tooltip for squeezing the grip or equivalent
    'grip': {type: 'string', default: null},

    // Shelf to refer to for more options
    shelf: {type: 'string', default: null},
  }
})

// Component attached to each hand which actually displays the [`action-tooltips`](#action-tooltips)
AFRAME.registerComponent('hand-action-tooltip', {
  dependencies: ['raycaster', 'action-tooltips'],
  schema: {
    throttle: {default: 150},
    position: {type: 'vec3', default: `-0.006549004823841076 -0.11940164556557662 0.10084264804121343`}
  },
  init() {
    let container = document.createElement('a-entity')
    container.setAttribute('geometry', 'primitive: plane; height: auto; width: auto')
    container.setAttribute('material', 'color: #abe; shader: flat')
    container.setAttribute('position', this.data.position)
    container.setAttribute('rotation', "-47.22767925743924 -1.2047588819680946 -2.40270564492676")
    container.setAttribute('scale', '0.15 0.15 0.15')
    container.setAttribute('text', `color: #000; width: 1; align: left; value: ...; wrapCount: 20; baseline: top`)
    this.container = container
    this.el.append(container)
    this.tick = AFRAME.utils.throttleTick(this.tick, this.data.throttle, this)

    this.buttons = [
      'trigger',
      'updown',
      'leftright',
      'a',
      'b',
      'grip',
    ]

    this.names = {
      'updown': "Up/Down",
      'leftright': "Left/Right",
      'a': "A",
      'b': "B",
      'trigger': "Trigger",
      'grip': "Grip"
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
        messageString[i++]= `> ${this.names[k]}: ${this.message[k]}`
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



export { JoystickDirections, ButtonMaps, Axes }
