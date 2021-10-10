import {Util} from './util.js'

Util.registerComponentSystem('scene-organizer', {

})

AFRAME.registerComponent('object3d-view', {
  schema: {
    target: {type: 'selector'},
    activeProperty: {default: 'localPosition'},
  },
  events: {
    editfinished: function(e) {
      switch (e.target) {
        case this.localPosition.x:
        case this.localPosition.y:
        case this.localPosition.z:
          this.data.target.object3D.position.set(parseFloat(this.localPosition.x.getAttribute('text').value),parseFloat(this.localPosition.y.getAttribute('text').value), parseFloat(this.localPosition.z.getAttribute('text').value))
          break
      }
    }
  },
  init() {
    this.el.innerHTML += require('./partials/object3d-view.html.slm')
    this.el.setAttribute('shelf', 'name: Object3D; width: 3; height: 3')
    this.el.classList.add('grab-root')
    Util.whenLoaded(this.el, () => {
      this.el.querySelectorAll('.root-target').forEach(el => {
        Util.whenLoaded(el, () => el.setAttribute('radio-button', 'target', this.el))
      })
      this.localPosition = {
        x: this.el.querySelector('.position.x'),
        y: this.el.querySelector('.position.y'),
        z: this.el.querySelector('.position.z')
      }
    })
  },
  update(oldData) {
    Util.whenLoaded([this.el, this.data.target], () => {
      this.localPosition.x.setAttribute('text', 'value', this.data.target.object3D.position.x)
      this.localPosition.y.setAttribute('text', 'value', this.data.target.object3D.position.y)
      this.localPosition.z.setAttribute('text', 'value', this.data.target.object3D.position.z)
    })
  }
})
