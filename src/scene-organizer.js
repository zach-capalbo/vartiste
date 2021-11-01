import {Util} from './util.js'

Util.registerComponentSystem('scene-organizer', {
  init() {
    this.childViews = new Map;
  }
})

AFRAME.registerComponent('object3d-view', {
  schema: {
    target: {type: 'selector'},
    activeProperty: {default: 'localPosition'},
    parentView: {type: 'selector'},
  },
  events: {
    editfinished: function(e) {
      e.stopPropagation()
      switch (e.target) {
        case this.localPosition.x:
        case this.localPosition.y:
        case this.localPosition.z:
          this.object.position.set(parseFloat(this.localPosition.x.getAttribute('text').value),parseFloat(this.localPosition.y.getAttribute('text').value), parseFloat(this.localPosition.z.getAttribute('text').value))
          break
      }
    },
    click: function(e) {
      e.stopPropagation()
      if (e.target.hasAttribute('object3d-view-action'))
      {
        this[e.target.getAttribute('object3d-view-action')]()
      }
    },
    snappedtoinput: function(e) {
      e.stopPropagation()
      if (!this.haveNodesBeenInitialized) return;
      console.log("Reparenting", this.nameString())
      let snappedto = e.detail.snapped.parentEl;

      this.reparent(snappedto.components['object3d-view'].object)
    }
  },
  init() {
    this.system = this.el.sceneEl.systems['scene-organizer']
    this.el.innerHTML += require('./partials/object3d-view.html.slm')
    this.el.setAttribute('shelf', 'name: Object3D; width: 3; height: 3; pinnable: false')
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
      },
      this.inputNode = this.el.querySelector('a-entity[node-input]')
      this.outputNode = this.el.querySelector('a-entity[node-output]')

      if (this.data.parentView)
      {
        Util.whenLoaded([this.el, this.inputNode, this.outputNode], () => {
          let nodeOutput = this.data.parentView.components['object3d-view'].outputNode.components['node-output'];
          nodeOutput.formConnectionTo(undefined, this.inputNode)
          this.haveNodesBeenInitialized = true
        })
      }
      else
      {
        this.inputNode.setAttribute('visible', false)
      }

      this.el.querySelector('.grab-redirector').setAttribute('grab-redirector', {target: this.isEl ? this.targetEl : this.object, handle: false})
    })
  },
  update(oldData) {
    if (this.data.target.object3D)
    {
      this.isEl = true
      this.targetEl = this.data.target
      this.object = this.targetEl.object3D
    }
    else
    {
      if (this.data.target.el)
      {
        this.targetEl = this.data.target.el
        this.isEl = this.data.target === this.data.target.el.object3D
      }
      else
      {
        this.targetEl = null
        this.isEl = false
      }
      this.object = this.data.target
    }

    console.log("Updated target", this.targetEl, this.object)

    Util.whenLoaded(this.targetEl ? [this.el, this.targetEl, this.contents] : [this.el, this.contents], () => {
      this.setVectorEditors(this.localPosition, this.object.position)
      this.el.setAttribute('shelf', 'name', this.nameString())
    })
  },
  nameString() {
    if (this.isEl)
    {
      if (this.targetEl.id) return "#" + this.targetEl.id
      if (this.targetEl.hasAttribute('primitive-construct-placeholder')) return "Shape Construct"
      if (this.targetEl.hasAttribute('reference-glb')) return "Reference Object"
      return `${this.targetEl.nodeName.toLowerCase()}[${Object.keys(this.targetEl.components).join(" ")}]`
    }

    return `${this.object.type} ${this.object.name || this.object.uuid}`
  },
  setVectorEditors(editors, vector) {
    editors.x.setAttribute('text', 'value', vector.x.toFixed(3))
    editors.y.setAttribute('text', 'value', vector.y.toFixed(3))
    editors.z.setAttribute('text', 'value', vector.z.toFixed(3))
  },
  loadChildren() {
    console.log('loading children', this.object.children)
    this.loadedChildren = true
    const zOffset = -0.1
    const scaleDown = 0.75
    const heightOffset = 2.7
    for (let i = 0; i < this.object.children.length; ++i)
    {
      let obj = this.object.children[i]
      if (this.system.childViews.has(obj)) continue;
      if (obj.userData.vartisteUI) continue;

      let view = document.createElement('a-entity')
      this.el.append(view)
      view.setAttribute('object3d-view', {target: obj, parentView: this.el})
      view.setAttribute('position', `3.3 ${(i - this.object.children.length / 2) * heightOffset } ${(i - this.object.children.length / 2) * -0.1}`)
      view.setAttribute('scale', `${scaleDown} ${scaleDown} ${scaleDown}`)
      this.system.childViews.set(obj, view)
    }
  },
  export() {
    this.el.sceneEl.systems['settings-system'].export3dAction(this.object)
  },
  trash() {
    // if (this.isEl) this.targetEl.parentEl.remove(this.targetEl) // ?

    this.object.parent.remove(this.object)
    Util.recursiveDispose(this.object)
    this.el.parentEl.remove(this.el)
  },
  hide() {
    this.object.visible = !this.object.visible
  },
  reparent(newParent) {
    Util.keepingWorldPosition(this.object, () => {
      this.object.parent = newParent
    })
  },
  onDeleted() {
    this.el.remove()
  },

  tick(t, dt) {
    if (this.isEl)
    {
      if (!this.targetEl.parentEl)
      {
        this.onDeleted()
      }
    }
    else
    {
      if (!this.object.parent)
      {
        this.onDeleted()
      }
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
        this.object = this.data.target
        if (!this.fakeTarget)
        {
          let fakeTarget = this.fakeTarget = document.createElement('a-entity')
          this.el.sceneEl.append(fakeTarget)
          this.el.sceneEl.systems['manipulator'].installConstraint(fakeTarget, () => {
            Util.positionObject3DAtTarget(this.object, fakeTarget.object3D)
          })
          Util.whenLoaded(fakeTarget, () => {
            Util.positionObject3DAtTarget(fakeTarget.object3D, this.object)
          })
          fakeTarget.addEventListener('stateadded', (e) => {
            if (e.detail === 'grabbed') {
              Util.positionObject3DAtTarget(fakeTarget.object3D, this.object)
            }
          })
        }
        this.globe['redirect-grab'] = this.fakeTarget
      }
      this.initialMatrix.copy(this.object.matrix)
    }
  }
})
