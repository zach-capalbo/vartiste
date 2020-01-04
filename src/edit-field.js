AFRAME.registerComponent('edit-field', {
  dependencies: ["text"],
  init() {
    this.el.setAttribute('text', {align: 'right'})
    let numpad = document.createElement('a-entity')
    this.numpad = numpad
    numpad.innerHTML = require('./partials/numpad.html.slm')
    numpad.setAttribute('position', '0 0 0.1')
    numpad.setAttribute('visible', 'false')
    numpad.addEventListener('click', e => this.buttonClicked(e))
    this.el.append(numpad)

    let width = this.el.getAttribute('text').width
    let editButton = document.createElement('a-entity')
    editButton.setAttribute('icon-button', "#asset-lead-pencil")
    editButton.setAttribute('position', `${width / 2 + 0.3} 0 0`)
    this.el.append(editButton)

    editButton.addEventListener('click', e => this.launchNumpad())
  },
  launchNumpad() {
    let numpad = this.numpad
    numpad.setAttribute('position', '0 0 0.1')
    numpad.object3D.updateMatrixWorld()
    let invScale =  numpad.object3D.parent.getWorldScale(new THREE.Vector3())
    invScale.x = 1 / invScale.x
    invScale.y = 1 / invScale.y
    invScale.z = 1 / invScale.z
    numpad.object3D.scale.copy(invScale)
    numpad.querySelector('.value').setAttribute('text', {value: this.el.getAttribute('text').value})
    numpad.setAttribute('visible', true)
  },
  setValue(value) {
    this.numpad.querySelector('.value').setAttribute('text', {value})
    this.el.setAttribute('text', {value})
  },
  buttonClicked(e) {
    console.log(e)
    let o = e.target.object3D
    let parentVisible = true
    o.traverseAncestors(a => parentVisible = parentVisible && a.visible)

    console.log("parentVisible", o.visible, parentVisible, e.detail.cursorEl.components.raycaster.objects.indexOf(e.target.object3D))
    let numpad = this.numpad
    if (e.target.hasAttribute('action'))
    {
      this[e.target.getAttribute('action')](e)
    }
    else if (e.target.hasAttribute('text'))
    {
      let buttonValue = e.target.getAttribute('text').value
      let existingValue = this.el.getAttribute('text').value
      this.setValue(existingValue + buttonValue)
    }
  },
  backspace(e) {
    this.setValue(this.el.getAttribute('text').value.slice(0, -1))
  },
  ok(e) {
    this.numpad.setAttribute('visible', false)
    this.numpad.setAttribute('position', '0 -999999 0.1')
  }
})
