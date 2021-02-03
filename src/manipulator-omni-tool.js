import {Util} from './util.js'

AFRAME.registerComponent('rotation-handles', {
  init() {

  }
})

AFRAME.registerComponent('manipulator-omni-tool', {
  events: {
    meshtool: function(e) {
      this.select(e.detail.el)
    },
    click: function(e) {
      if (e.target.hasAttribute('click-action'))
      {
        this[e.target.getAttribute('click-action')](e)
      }
    }
  },
  init() {
    this.el.innerHTML = require('./partials/manipulator-omni-tool.html.slm')
    let selector = document.createElement('a-entity')
    this.el.querySelector('.grab-root').append(selector)
    selector.setAttribute('scale', '3 3 3')
    selector.setAttribute('position', '2.5 0 0')
    selector.setAttribute('rotation', '-15 0 0')
    selector.setAttribute('hide-mesh-tool', 'mode: emit; far: Infinity; objects: .clickable, .canvas, .reference-glb, .frozen')
    // Util.whenLoaded(selector, () => selector.setAttribute('raycaster', 'near', 1))
    this.selector = selector
  },
  select(el) {
    el = Util.resolveGrabRedirection(el)
    this.target = el

    console.log("Omnitool Selecting", el)
    this.el.querySelector('*[shelf]').setAttribute('shelf', 'name', el.id)

  },
  freeze() {
    if (!this.target) return
    this.target.classList.add('frozen')
    this.target.classList.remove('clickable')
    if (this.target.classList.contains('canvas'))
    {
      this.target.classList.add('frozen-canvas')
      this.target.classList.remove('canvas')
    }
    this.el.sceneEl.emit('refreshobjects')
    console.log("Froze", this.target)
  }
})
