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
          this.object.position.set(parseFloat(this.localPosition.x.getAttribute('text').value),parseFloat(this.localPosition.y.getAttribute('text').value), parseFloat(this.localPosition.z.getAttribute('text').value))
          break
      }
    },
    click: function(e) {
      if (e.target.hasAttribute('object3d-view-action'))
      {
        this[e.target.getAttribute('object3d-view-action')]()
      }
    }
  },
  init() {
    this.el.innerHTML += require('./partials/object3d-view.html.slm')
    this.el.setAttribute('shelf', 'name: Object3D; width: 3; height: 3')
    this.el.classList.add('grab-root')
    this.contents = this.el.querySelector('*[shelf-content]')
    Util.whenLoaded([this.el, this.contents], () => {
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
    if (this.data.target.object3D)
    {
      this.targetEl = this.data.target
      this.object = this.targetEl.object3D
    }
    else
    {
      if (this.data.target.el)
      {
        this.targetEl = this.data.target.el
      }
      else
      {
        this.targetEl = null
      }
      this.object = this.data.target
    }

    console.log("Updated target", this.targetEl, this.object)

    Util.whenLoaded(this.targetEl ? [this.el, this.targetEl, this.contents] : [this.el, this.contents], () => {
      this.setVectorEditors(this.localPosition, this.object.position)
    })
  },
  setVectorEditors(editors, vector) {
    editors.x.setAttribute('text', 'value', vector.x.toFixed(3))
    editors.y.setAttribute('text', 'value', vector.y.toFixed(3))
    editors.z.setAttribute('text', 'value', vector.z.toFixed(3))
  },
  loadChildren() {
    console.log('loading children', this.object.children)
    const zOffset = -0.1
    const scaleDown = 0.75
    const heightOffset = 2.7
    for (let i = 0; i < this.object.children.length; ++i)
    {
      let obj = this.object.children[i]
      let view = document.createElement('a-entity')
      this.el.append(view)
      view.setAttribute('object3d-view', {target: obj})
      view.setAttribute('position', `3.3 ${(i - this.object.children.length / 2) * heightOffset } ${(i - this.object.children.length / 2) * -0.1}`)
      view.setAttribute('scale', `${scaleDown} ${scaleDown} ${scaleDown}`)
    }
  }
})

AFRAME.registerComponent('grab-redirector', {
  schema: {
    target: {type: 'selector'},
    handle: {default: true},
    radius: {default: 0.3},
    resetOnClick: {default: false},
  },
  events: {
    click: function(e) {
      if (!this.data.resetOnClick) return;
      if (e.detail.cursorEl && e.detail.cursorEl.id === 'mouse' && e.target === this.globe) return;
      Util.applyMatrix(this.initialMatrix, this.object)
    }
  },
  init() {
    if (this.data.handle)
    {
      let handle = this.handle = this.el.sceneEl.systems['pencil-tool'].createHandle({radius: this.data.radius, height: this.data.radius * 4, parentEl: this.el})
      handle.setAttribute('position', `0 ${-this.data.radius * 3} 0`)
      handle['redirect-grab'] = this.el
    }

    let globe = this.globe = document.createElement('a-entity')
    this.el.append(globe)
    globe.setAttribute('geometry', `primitive: sphere; radius: ${this.data.radius}; segmentsWidth: 8; segmentsHeight: 8`)
    globe.setAttribute('material', 'wireframe: true; shader: matcap')
    globe.classList.add('clickable')

    this.initialMatrix = new THREE.Matrix4
  },
  update(oldData) {
    if (this.data.target !== oldData.target)
    {
      if (this.data.target.object3D)
      {
        this.globe['redirect-grab'] = this.data.target
        this.object = this.data.target.object3D
      }
      else
      {

      }
      this.initialMatrix.copy(this.object.matrix)
    }
  }
})
