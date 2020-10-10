import {Util} from './util.js'
AFRAME.registerSystem('edit-field', {
})

// Creates an edit button, which pops up a keyboard to edit the text in the
// elements `text` component. The keyboard can be edited either through clicking
// the 3D buttons with the mouse or laser-controller, or by typing on a physical
// keyboard connected to the computer, or by speech recognition on supported
// browsers.
AFRAME.registerComponent('edit-field', {
  dependencies: ["text", 'popup-button'],
  schema: {
    // Tooltip to go on the edit button
    tooltip: {type: 'string'},

    // What kind of keyboard to pop up. Either 'number' or 'string'
    type: {type: 'string', default: 'number'},

    // [Optional] If set, will edit another elements component property
    target: {type: 'selector'},
    // If `target` is set, this is the component to edit
    component: {type: 'string'},
    // If `target` is set, this is the property to edit
    property: {type: 'string'},

    // When true, this will clear the current value of the property when editing
    // (mainly to avoid the user having to backspace everything)
    autoClear: {type: 'boolean', default: false}
  },
  events: {
    'popuplaunched': function(e) { this.connectKeyboard()},
    'popupclosed': function(e) { this.disconnectKeyboard()}
  },
  init() {
    this.numpad = this.el.components['popup-button'].popup
    let {numpad} = this

    this.inputField = document.createElement('input')
    this.inputField.classList.add('keyboard-form')
    this.inputField.editField = this
    document.body.append(this.inputField)

    this.inputField.addEventListener('keyup', (e) => {
      if (event.key === "Enter")
      {
        this.ok()
      }
    })

    this.inputField.addEventListener('input', (e) => {
      this.setValue(this.inputField.value)
      // this.numpad.querySelector('.value').setAttribute('text', {value: this.inputField.value})
    })

    numpad.addEventListener('click', e => this.buttonClicked(e))

    this.el.addEventListener('popuplaunched', e => {
      numpad.querySelector('.value').setAttribute('text', {value: this.el.getAttribute('text').value})
      numpad.setAttribute('visible', true)
      if (this.data.type === 'number' || this.data.autoClear)
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

    if (this.data.target !== oldData.target)
    {
      if (oldData.target)
      {
        oldData.target.removeEventListener('componentchanged', this.componentchangedlistener)
      }

      if (this.data.target)
      {
        this.componentchangedlistener = (e) => {
          if (e.detail.name === this.data.component)
          {
            this.setValue(this.data.target.getAttribute(this.data.component)[this.data.property].toString(), {update: false})
          }
        }
        this.data.target.addEventListener('componentchanged', this.componentchangedlistener)

        Util.whenLoaded([this.numpad, this.el, this.data.target], () => {
          this.setValue(this.data.target.getAttribute(this.data.component)[this.data.property].toString(), {update: false})
        })
      }
    }
  },
  remove() {
    this.inputField.remove()
  },
  setValue(value, {update=true} = {}) {
    this.numpad.querySelector('.value').setAttribute('text', {value})
    this.el.setAttribute('text', {value})
    this.inputField.value = value
    if (update && this.data.target)
    {
      this.data.target.setAttribute(this.data.component, {[this.data.property]: value})
    }
  },
  buttonClicked(e) {
    console.log(e)
    let o = e.target.object3D
    let parentVisible = true
    o.traverseAncestors(a => parentVisible = parentVisible && a.visible)

    this.inputField.focus()

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
  },
  async paste(e) {
    this.inputField.focus()
    if (!navigator.clipboard) {
      document.execCommand("paste")
      return
    }

    this.setValue(await navigator.clipboard.readText())
  },
  connectKeyboard() {
    console.log("Connecting keyboard")
    this.inputField.focus()
    // let form = document.createElement('input')
    // this.keyUpListener = e => {
    //   console.log("Keyboard got key", e.key)
    //   let ne = new e.constructor(e.type, e)
    //   form.dispatchEvent(ne)
    //   e.preventDefault()
    //   // e.stopPropagation()
    //   // let buttonValue = e.key
    //   // let existingValue = this.el.getAttribute('text').value
    //   this.setValue(form.value)
    // };
    // document.addEventListener('keyup', this.keyUpListener)
  },
  disconnectKeyboard() {
    this.inputField.blur()
    this.el.sceneEl.canvas.focus()
  }
})

// Creates or uses an [`icon-button`](#icon-button), which when clicked will create a popup at
// the location of the button
AFRAME.registerComponent('popup-button', {
  dependencies: ["text"],
  schema: {
    tooltip: {type: 'string'},
    icon: {type: 'string', default: '#asset-lead-pencil'},

    // Right now, this has to be one of the precompiled VARTISTE partials. I intend to make this more extensible.
    popup: {type: 'string', default: "numpad"},

    // Scale for the popup when shown
    scale: {type: 'vec3', default: '1 1 1'},

    // If true, the popup entity will not be loaded until the button is clicked
    deferred: {type: 'boolean', default: false}
  },
  init() {
    let editButton
    if (!this.el.hasAttribute('icon-button'))
    {
      this.el.setAttribute('text', {align: 'right'})
      let width = this.el.getAttribute('text').width

      editButton = document.createElement('a-entity')
      editButton.setAttribute('position', `${width / 2 + 0.3} 0 0`)
      editButton.setAttribute('icon-button', this.data.icon)
      this.el.append(editButton)
      editButton.addEventListener('click', e => this.launchPopup())
    }
    else
    {
      editButton = this.el
      this.el.addEventListener('click', e => {
        if (e.target === editButton) this.launchPopup()
      })
    }
    this.editButton = editButton

    let popup = document.createElement('a-entity')
    this.popup = popup

    popup.setAttribute('position', '0 0 0.1')
    popup.setAttribute('visible', 'false')

    if (!this.el.hasAttribute('icon-button'))
    {
      this.el.append(popup)
    }
    else {
      this.el.parentEl.append(popup)
    }

    popup.addEventListener('click', e => {
      if (!e.target.hasAttribute('popup-action')) return

      this[e.target.getAttribute('popup-action') + "Popup"]()
    })

    popup.addEventListener('popupaction', e => {
      this[e.detail + "Popup"]()
    })
  },
  update(oldData) {
    if (this.data.tooltip)
    {
      this.editButton.setAttribute('tooltip', this.data.tooltip)
    }
    if (this.data.popup !== oldData.popup && !this.data.deferred)
    {
      this.popup.innerHTML = require(`./partials/${this.data.popup}.html.slm`)
    }
    if (!this.popupLoaded && !this.data.deferred)
    {
      console.log("Initing popup", this.data.deferred, this.data);
      this.popup.innerHTML = require(`./partials/${this.data.popup}.html.slm`)
      this.popupLoaded = true
    }
  },
  launchPopup() {
    let popup = this.popup
    if (!this.popupLoaded)
    {
      popup.innerHTML = require(`./partials/${this.data.popup}.html.slm`)
      this.popupLoaded = true
    }
    popup.setAttribute('position', '0 0 0.1')
    popup.object3D.updateMatrixWorld()
    let invScale =  popup.object3D.parent.getWorldScale(new THREE.Vector3())
    invScale.x = this.data.scale.x / invScale.x
    invScale.y = this.data.scale.y / invScale.y
    invScale.z = this.data.scale.z / invScale.z
    popup.object3D.scale.copy(invScale)

    popup.setAttribute('visible', true)
    this.el.sceneEl.emit('refreshobjects')
    this.el.emit('popuplaunched')
    popup.emit('popupshown')
  },
  closePopup() {
    this.popup.setAttribute('visible', false)
    this.popup.setAttribute('position', '0 -999999 0.1')
    this.el.emit('popupclosed')
  }
})
