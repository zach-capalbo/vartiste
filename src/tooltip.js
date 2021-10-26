import {Util} from './util.js'

const USE_TROIKA_DIRECT = false;

// Shows some text when hovered by the mouse or controller laser pointer. Can be
// styled with [tooltip-style](#tooltip-style). If [speech](#speech) is enabled,
// the tooltip will be read with text-to-speech when hovered.
//
// Here's an [`icon-button`](#icon-button) with a tooltip:
//
// ```
// <a-entity icon-button="#asset-close" tooltip="Close"></a-entity>
// ```
//
// ![button with a tooltip](./static/images/tooltipbutton.png)
AFRAME.registerComponent('tooltip', {
  // Text to show in the tooltip
  schema: {default: ""},
  multiple: true,
  events: {
    'mouseenter': function() {this.popup();},
    'mouseleave': function() {this.hide();},
  },
  init() {
    this.targetY = 0.3

    let tooltip = document.createElement('a-entity')
    this.tooltip = tooltip
    tooltip.setAttribute('geometry', 'primitive: plane; height: 0; width: 0')
    tooltip.setAttribute('material', 'color: #abe; shader: flat')
    tooltip.setAttribute('position', '0 0.4 0.004')

    if (USE_TROIKA_DIRECT)
    {
      tooltip.setAttribute('troika-text', `color: #000; maxWidth: 1; align: center; value: ${this.data}`)
      this.tooltip.setAttribute('geometry', `primitive: plane; height: 0.06; width: 1`)
    }
    else
    {
      tooltip.setAttribute('text', `color: #000; width: 1; align: center; value: ${this.data}; wrapCount: 10; zOffset: ${0.005}; baseline: bottom`)
    }

    // tooltip.setAttribute('troika-text', 'outlineBlur', 0.01)
    // tooltip.setAttribute('troika-text', 'outlineColor', '#637ecf')
    // tooltip.setAttribute('troika-text', 'outlineWidth', 0.030)
    // tooltip.setAttribute('troika-text', 'outlineOpacity', 0.9)

    tooltip.setAttribute('class', 'raycast-invisible')
    tooltip.setAttribute('visible', false)
    this.el.append(tooltip)
    // Util.whenLoaded(tooltip, () => {
    //   tooltip.components.material.material.depthFunc = THREE.AlwaysDepth
    //   tooltip.components.material.material.depthWrite = false
    // })
  },
  update(oldData) {
    if (!this.el.hasLoaded) return

    if (USE_TROIKA_DIRECT)
    {
      this.tooltip.setAttribute('troika-text', `color: #000; maxWidth: 2; align: center; value: ${this.translate(this.data)}; depthOffset: -0.1`)

      Util.whenComponentInitialized(this.tooltip, 'troika-text', () => {
        let g = this.tooltip.components['troika-text'].troikaTextMesh.geometry
        this.tooltip.components['troika-text'].troikaTextMesh.position.z = 0.01
        this.tooltip.components['troika-text'].troikaTextMesh._needsSync = true
        this.tooltip.components['troika-text'].troikaTextMesh.sync(() => {
          g.computeBoundingBox()
          let bb = g.boundingBox;
          this.tooltip.setAttribute('geometry', `primitive: plane; height: ${(bb.max.y - bb.min.y) + 0.1}; width: ${(bb.max.x - bb.min.x) + 0.1}`)
        })
      })
    }
    else
    {
      this.tooltip.setAttribute('text', `color: #000;width: 1; align: center; value: ${this.translate(this.data)}`)
    }
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
  },
  translate(str) {
    if (!this.el.sceneEl.systems['ui-translation']) return str;

    return this.el.sceneEl.systems['ui-translation'].translate(str, this.el)
  }
})

// Allows manipulation of [`tooltip`](#tooltip) size, placement and style.
AFRAME.registerComponent('tooltip-style', {
  dependencies: ["tooltip"],
  multiple: true,
  schema: {
    // Offsets tooltip in three dimensions using vec3.
    offset: {type: 'vec3', default: new THREE.Vector3(0, 0, 0)},
    // Scales tooptip in three dimensions using vec3.
    scale: {type: 'vec3', default: new THREE.Vector3(1, 1, 1)},
    // Rotates tooltip in three dimensions using vec3, in degrees.
    rotation: {type: 'vec3', default: new THREE.Vector3(0, 0, 0)},
    // Number of characters before text wraps to next line.
    wrapCount: {default: 10}
  },
  update(oldData) {
    Util.whenLoaded(this.el, () => {
      let component = this.el.components[this.attrName.replace("-style", "")]
      if (!component) {
        // console.warn("No tooltip component yet", this.attrName)
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

// Makes the tooltip visible before the first time it's hovered
AFRAME.registerComponent('previsible-tooltip', {
  init() {
    Util.whenComponentInitialized(this.el, 'tooltip', () => {
      console.log("Popping up previs")
      this.el.components['tooltip'].popup()
    })
  }
})
