AFRAME.registerComponent("frame", {
  dependencies: ['geometry'],
  schema: {
    closable: {default: true},
    pinnable: {default: true},
    outline: {default: true},
    outlineColor: {type: 'color', default: "#52402b"},
  },
  events: {
    click: function (e) {
      if (e.target.hasAttribute('frame-action'))
      {
        this[e.target.getAttribute('frame-action')]()
      }
    }
  },
  init() {
    let {width, height} = this.el.getAttribute('geometry')

    let closeButton = document.createElement('a-entity')
    closeButton.setAttribute('icon-button', '#asset-close-circle-outline')
    closeButton.setAttribute('button-style', 'buttonType: plane; depth: 0; color: #26211c')
    closeButton.setAttribute('position', `${width / 2 - 0.055} ${height / 2 + 0.055} 0`)
    closeButton.setAttribute('scale', `0.3 0.3 1`)
    closeButton.setAttribute('frame-action', "closeFrame")
    this.el.append(closeButton)
  },
  update(oldData) {
    let {width, height} = this.el.getAttribute('geometry')

    if (this.data.outline && !this.lineObject)
    {
      let zOffset = -0.001
      let outline = new THREE.Geometry()
      outline.vertices.push(new THREE.Vector3(-width / 2, height / 2, zOffset));
      outline.vertices.push(new THREE.Vector3(width / 2, height / 2, zOffset));
      outline.vertices.push(new THREE.Vector3(width / 2, - height / 2, zOffset));
      outline.vertices.push(new THREE.Vector3(-width / 2, - height / 2, zOffset));
      outline.vertices.push(new THREE.Vector3(-width / 2, height / 2, zOffset));

      let lineObject = new THREE.Line(outline, new THREE.LineBasicMaterial( { color: this.data.outlineColor, linewidth: 5 } ))
      this.el.object3D.add(lineObject)
      this.lineObject = lineObject
    }
    else if (!this.data.outline && this.lineObject)
    {
      this.el.object3D.remove(this.lineObject)
      delete this.lineObject
    }
  },
  closeFrame() {
    this.el.parentEl.removeChild(this.el)
  }
})
