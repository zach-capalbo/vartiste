AFRAME.registerComponent('edit-field', {
  dependencies: ["text", 'popup-button'],
  schema: {
    tooltip: {type: 'string'},
    type: {type: 'string', default: 'number'}
  },
  init() {
    this.numpad = this.el.components['popup-button'].popup
    let {numpad} = this

    numpad.addEventListener('click', e => this.buttonClicked(e))

    this.el.addEventListener('popuplaunched', e => {
      numpad.querySelector('.value').setAttribute('text', {value: this.el.getAttribute('text').value})
      numpad.setAttribute('visible', true)
      if (this.data.type === 'number')
      {
        this.setValue("")
      }
    })

  },
  update(oldData) {
    this.el.setAttribute('popup-button', {
      icon: "#asset-lead-pencil",
      tooltip: this.data.tooltip,
      popup: (this.data.type === 'string' ? "keyboard" : "numpad")
    })
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
    this.el.components['popup-button'].closePopup()
    this.el.emit("editfinished", {value: this.el.getAttribute('text').value})
  },
  clear(e) {
    this.setValue("")
  }
})

AFRAME.registerComponent('popup-button', {
  dependencies: ["text"],
  schema: {
    tooltip: {type: 'string'},
    icon: {type: 'string', default: '#asset-lead-pencil'},
    popup: {type: 'string', default: "numpad"}
  },
  init() {
    this.el.setAttribute('text', {align: 'right'})
    let width = this.el.getAttribute('text').width

    let editButton = document.createElement('a-entity')
    this.editButton = editButton
    editButton.setAttribute('icon-button', this.data.icon)
    editButton.setAttribute('position', `${width / 2 + 0.3} 0 0`)
    this.el.append(editButton)

    editButton.addEventListener('click', e => this.launchPopup())

    let popup = document.createElement('a-entity')
    this.popup = popup
    popup.innerHTML = require(`./partials/${this.data.popup}.html.slm`)
    popup.setAttribute('position', '0 0 0.1')
    popup.setAttribute('visible', 'false')
    this.el.append(popup)

    popup.addEventListener('click', e => {
      if (!e.target.hasAttribute('popup-action')) return

      this[e.target.getAttribute('popup-action') + "Popup"]()
    })
  },
  update(oldData) {
    if (this.data.tooltip)
    {
      this.editButton.setAttribute('tooltip', this.data.tooltip)
    }
    if (this.data.popup !== oldData.popup)
    {
      this.popup.innerHTML = require(`./partials/${this.data.popup}.html.slm`)
    }
  },
  launchPopup() {
    let popup = this.popup
    popup.setAttribute('position', '0 0 0.1')
    popup.object3D.updateMatrixWorld()
    let invScale =  popup.object3D.parent.getWorldScale(new THREE.Vector3())
    invScale.x = 1 / invScale.x
    invScale.y = 1 / invScale.y
    invScale.z = 1 / invScale.z
    popup.object3D.scale.copy(invScale)

    popup.setAttribute('visible', true)
    this.el.sceneEl.emit('refreshobjects')
    this.el.emit('popuplaunched')
  },
  closePopup() {
    this.popup.setAttribute('visible', false)
    this.popup.setAttribute('position', '0 -999999 0.1')
  }
})
