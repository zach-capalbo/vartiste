AFRAME.registerComponent('tooltip', {
  schema: {default: ""},
  init() {
    let tooltip = document.createElement('a-entity')
    this.tooltip = tooltip
    tooltip.setAttribute('geometry', 'primitive: plane; height: auto; width: auto')
    tooltip.setAttribute('material', 'color: #abe; shader: flat')
    tooltip.setAttribute('position', '0 0.4 0.004')
    tooltip.setAttribute('text', `color: #000; width: 1; align: center; value: ${this.data}; wrapCount: 10`)
    tooltip.setAttribute('class', 'raycast-invisible')
    tooltip.setAttribute('visible', false)
    this.el.addEventListener('mouseenter', e => {
      this.popup()
    })
    this.el.addEventListener('mouseleave', e=> {
      this.hide()
    })
    this.el.append(tooltip)
  },
  update(oldData) {
    if (!this.el.hasLoaded) return

    this.tooltip.setAttribute('text', `color: #000;width: 1; align: center; value: ${this.data}`)
  },
  popup() {
    this.tooltip.object3D.position.y = 0.4
    this.tooltip.setAttribute('visible', true)
  },
  hide() {
    this.tooltip.object3D.position.y = -99999999
    this.tooltip.setAttribute('visible', false)
    this.el.sceneEl.emit('refreshobjects')
  }
})
