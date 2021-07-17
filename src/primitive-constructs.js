import {Util} from './util.js'
Util.registerComponentSystem('primitive-constructs', {
  grabConstruct(el) {
    if (el === this.lastGrabbed) return;

    if (this.lastGrabbed)
    {
      this.lastGrabbed.removeAttribute('axis-handles')
    }
    this.lastGrabbed = el

    el.setAttribute('axis-handles', '')
  },
  makeDrawable() {
    let shapes = Array.from(document.querySelectorAll('*[primitive-construct-placeholder]')).filter(el => el.getAttribute('primitive-construct-placeholder').detached)


  }
})

AFRAME.registerComponent('primitive-construct-placeholder', {
  schema: {
    primitive: {},
    detached: {default: false},
  },
  events: {
    stateadded: function(e) {
      if (e.detail === 'grabbed')
      {
        if (!this.data.detached)
        {
          this.detachCopy()
        }
        this.system.grabConstruct(this.el)
      }
    }
  },
  init() {
    this.system = this.el.sceneEl.systems['primitive-constructs'];
    this.el.setAttribute('geometry', `primitive: ${this.data.primitive};`)
    this.el.setAttribute('show-current-color', '')
    this.el.setAttribute('material', `shader: matcap`)
    this.el.classList.add('clickable')
  },
  update(oldData) {},
  detachCopy() {
    console.log("Detaching copy", this.el)

    this.el.removeAttribute('show-current-color')

    let newPlaceHolder = document.createElement('a-entity')
    this.el.parentEl.append(newPlaceHolder)
    newPlaceHolder.setAttribute('primitive-construct-placeholder', this.el.getAttribute('primitive-construct-placeholder'))
    newPlaceHolder.setAttribute('position', this.el.getAttribute('position'))
    this.el.setAttribute('primitive-construct-placeholder', 'detached', true)

    Util.keepingWorldPosition(this.el.object3D, () => {
      this.el.object3D.parent.remove(this.el.object3D)
      this.el.sceneEl.object3D.add(this.el.object3D)
    })
  },
  makeReal() {
  },
})
