AFRAME.registerComponent('controller-proxy', {
  schema: {
    layout: {oneOf: ['left', 'right']},
  },
  init() {

  },
})

AFRAME.registerComponent('controller-touch-button', {
  schema: {
    button: {type: 'string'},
    label: {type: 'string'},
    pressureSensitive: {default: false},
    throttle: {default: 20},
  },
  init() {
    this.el.setAttribute('geometry', 'primitive: box; width: 0.3; height: 0.3; depth: 0.3')
  },
  tick(t, dt) {

  }
})
