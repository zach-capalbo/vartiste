import {Util} from './util.js'

// Shows some text when hovered. Can be styled with
// [tooltip-style](#tooltip-style). If [speech](#speech) is enabled, the tooltip
// will be read with text-to-speech when hovered.
AFRAME.registerComponent('tooltip', {
  // Text to show in the tooltip
  schema: {default: ""},
  multiple: true,
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
    tooltip.setAttribute('text', `color: #000; width: 1; align: center; value: ${this.data}; wrapCount: 10; zOffset: ${0.005}`)
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
  multiple: true,
  schema: {
    offset: {type: 'vec3', default: '0 0 0'},
    scale: {type: 'vec3', default: '1 1 1'},
    rotation: {type: 'vec3', default: '0 0 0'},
    wrapCount: {default: 10}
  },
  update(oldData) {
    Util.whenLoaded(this.el, () => {
      let component = this.el.components[this.attrName.replace("-style", "")]
      if (!component) {
        console.warn("No tooltip component yet", this.attrName)
        Util.callLater(this.update.bind(this, oldData))
        return
      }
      component.targetY = this.data.offset.y + 0.4
      component.tooltip.setAttribute('text', 'wrapCount', this.data.wrapCount)
      component.tooltip.object3D.position.x = this.data.offset.x
      component.tooltip.object3D.position.z = this.data.offset.z + 0.004
      component.tooltip.object3D.scale.copy(this.data.scale)
      component.tooltip.object3D.rotation.set(this.data.rotation.x * Math.PI / 180,
                                                               this.data.rotation.y * Math.PI / 180,
                                                               this.data.rotation.z * Math.PI / 180,)
                                                             })
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
