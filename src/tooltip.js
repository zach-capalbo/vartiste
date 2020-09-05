// Shows some text when hovered. Can be styled with
// [tooltip-style](#tooltip-style). If [speech](#speech) is enabled, the tooltip
// will be read with text-to-speech when hovered.
AFRAME.registerComponent('tooltip', {
  // Text to show in the tooltip
  schema: {default: ""},
  events: {
    'mouseenter': function() {this.popup();},
    'mouseleave': function() {this.hide();},
  },
  init() {
    this.targetY = 0.4

    let tooltip = document.createElement('a-entity')
    this.tooltip = tooltip
    tooltip.setAttribute('geometry', 'primitive: plane; height: auto; width: auto')
    tooltip.setAttribute('material', 'color: #abe; shader: flat')
    tooltip.setAttribute('position', '0 0.4 0.004')
    tooltip.setAttribute('text', `color: #000; width: 1; align: center; value: ${this.data}; wrapCount: 10`)
    tooltip.setAttribute('class', 'raycast-invisible')
    tooltip.setAttribute('visible', false)
    this.el.append(tooltip)
  },
  update(oldData) {
    if (!this.el.hasLoaded) return

    this.tooltip.setAttribute('text', `color: #000;width: 1; align: center; value: ${this.data}`)
  },
  remove() {
    this.el.removeChild(this.tooltip)
    delete this.tooltip
  },
  popup() {
    this.tooltip.object3D.position.y = this.targetY
    this.tooltip.setAttribute('visible', true)
    this.el.sceneEl.components['speech'].speak(this.data)
  },
  hide() {
    this.el.sceneEl.components['speech'].cancel(this.data)
    this.tooltip.object3D.position.y = -99999999
    this.tooltip.setAttribute('visible', false)
    // this.el.sceneEl.emit('refreshobjects')
  }
})

// Allows you to change the style of the [`tooltip`](#tooltip) component somewhat
AFRAME.registerComponent('tooltip-style', {
  dependencies: ["tooltip"],
  schema: {
    offset: {type: 'vec3', default: '0 0 0'},
    scale: {type: 'vec3', default: '1 1 1'},
  },
  update(oldData) {
    this.el.components.tooltip.targetY = this.data.offset.y + 0.4
    this.el.components.tooltip.tooltip.object3D.position.x = this.data.offset.x
    this.el.components.tooltip.tooltip.object3D.position.z = this.data.offset.z + 0.004
    this.el.components.tooltip.tooltip.object3D.scale.copy(this.data.scale)
  }
})

// Creates a tooltip that goes away once the element receives the `activate`
// event
AFRAME.registerComponent('preactivate-tooltip', {
  // The tooltip to show
  schema: {default: ""},
  events: {
    activate: function() {
      this.el.removeAttribute('tooltip')
      this.el.removeAttribute('preactivate-tooltip')
    }
  },
  update() {
    this.el.setAttribute('tooltip', this.data)
  }
})

// Creates a tooltip which is not visible, for the purposes of enabling
// text-to-speech on the element
AFRAME.registerComponent('hidden-tooltip', {
  // The tooltip text
  schema: {default: ""},
  init() {
    this.el.setAttribute('tooltip-style', "offset: 0 -999999 0")
  },
  update() {
    this.el.setAttribute('tooltip', this.data)
  }
})
