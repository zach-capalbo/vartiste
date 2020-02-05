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
  constructor(where) {
    this.dirX = 0;
    this.dirY = 0;

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

    where.el.addEventListener('axismove', e => {
      if (where.el.is('grabbing')) return;

      const { detail } = e;

      if (this.handleX)
      {
        if ((detail.axis[Axes.left_right(where.el)] > 0.8) && (this.dirX !== 1)) {
          this.dirX = 1;
          this.rightClick(detail)
        } else if ((-0.8 < detail.axis[Axes.left_right(where.el)] && detail.axis[Axes.left_right(where.el)] < 0.8) && (this.dirX !== 0)) {
          return this.dirX = 0;
        } else if ((detail.axis[Axes.left_right(where.el)] < -0.8) && (this.dirX !== -1)) {
          this.dirX = -1;
          this.leftClick(detail);
        }
      }

      if (this.handleY)
      {
        if ((detail.axis[Axes.up_down(where.el)] > 0.8) && (this.dirY !== 1)) {
          console.log("Clicking up", detail.axis[Axes.up_down(where.el)], this.dirY)
          this.dirY = 1;
          this.upClick(detail)
        } else if ((-0.8 < detail.axis[Axes.up_down(where.el)] && detail.axis[Axes.up_down(where.el)] < 0.8) && (this.dirY !== 0)) {
          console.log("Clicking reset", detail.axis[Axes.up_down(where.el)], this.dirY)
          return this.dirY = 0;
        } else if ((detail.axis[Axes.up_down(where.el)] < -0.8) && (this.dirY !== -1)) {
          console.log("Clicking down", detail.axis[Axes.up_down(where.el)], this.dirY)
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
    console.log("Buttons", this.buttons)
    for (let button of new Set(this.buttons))
    {
      console.log("Installing", button)
      where.el.addEventListener(button + 'down', e => {
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
  install(where) {
    new JoystickDirectionHandler(where)
  }
}

export { JoystickDirections, ButtonMaps, Axes }
