import {Util} from './util.js'

Util.registerComponentSystem('scene-organizer', {

})

AFRAME.registerComponent('object3d-view', {
  init() {
    this.el.setAttribute('shelf', 'name: Object3D')
    this.el.classList.add('grab-root')
    this.el.innerHTML = require('./partials/object3d-view.html.slm')
  }
})
