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
        if ((detail.axis[0] > 0.8) && (this.dirX !== 1)) {
          this.dirX = 1;
          this.rightClick(detail)
        } else if ((-0.8 < detail.axis[0] && detail.axis[0] < 0.8) && (this.dirX !== 0)) {
          return this.dirX = 0;
        } else if ((detail.axis[0] < -0.8) && (this.dirX !== -1)) {
          this.dirX = -1;
          this.leftClick(detail);
        }
      }

      if (this.handleY)
      {
        if ((detail.axis[1] > 0.8) && (this.dirY !== 1)) {
          this.dirY = 1;
          this.upClick(detail)
        } else if ((-0.8 < detail.axis[1] && detail.axis[1] < 0.8) && (this.dirY !== 0)) {
          return this.dirY = 0;
        } else if ((detail.axis[1] < -0.8) && (this.dirY !== -1)) {
          this.dirY = -1;
          this.downClick(detail);
        }
      }
    });
  }
}

const JoystickDirections = {
  install(where) {
    new JoystickDirectionHandler(where)
  }
}

export { JoystickDirections }
