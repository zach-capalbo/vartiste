import {Util} from './util.js'

AFRAME.registerComponent('controller-proxy', {
  schema: {
    layout: {oneOf: ['left', 'right'], default: 'right'},
    holdDuration: {default: 50},
  },
  events: {
    click: function(e) {
      if (e.target.hasAttribute('proxy-button'))
      {
        this.simulateButton(e.target.getAttribute('proxy-button'))
      }
    }
  },
  init() {
    this.el.innerHTML += require('./partials/controller-proxy.html.slm')
  },
  update(oldData) {
    this.targetHand = this.data.layout === 'right' ? this.el.sceneEl.querySelector('#right-hand') : this.el.sceneEl.querySelector('#left-hand')

    let shelf = this.el.querySelector('a-entity[shelf]')
    Util.whenLoaded(shelf, () => {
      shelf.setAttribute('shelf', 'name', `${this.data.layout}-hand Button Board`)
    })
  },
  async simulateButton(button) {
    console.log(`Simulating "${button}" for ${this.data.layout} hand`)
    if (button.length === 1) {
      button = button + "button"
    }
    this.targetHand.emit(`${button}down`, {})
    await Util.delay(this.data.holdDuration)
    this.targetHand.emit(`${button}up`, {})
  }
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
