import {Util} from './util.js'

// App-wide edit field properties
AFRAME.registerSystem('edit-field', {
  schema: {
    // Controls the global scaling of the edit field pop-ups. Applied on top of
    // any individual edit-field popup scaling properties
    scale: {type: 'vec3', default: new THREE.Vector3(1, 1, 1)}
  }
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

    // What kind of keyboard to pop up. Either 'number', 'string', or 'dropdown'
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
    this.el.setAttribute('popup-button', 'scale', this.system.data.scale)
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

    this.inputField.addEventListener('keydown', (e) => {
      e.stopPropagation()
    })

    this.inputField.addEventListener('input', (e) => {
      this.setValue(this.inputField.value)
      // this.numpad.querySelector('.value').setAttribute('text', {value: this.inputField.value})
    })

    numpad.addEventListener('click', e => this.buttonClicked(e))

    this.el.addEventListener('popuplaunched', e => {
      numpad.querySelector('.value').setAttribute('text', {value: this.el.getAttribute('text').value})
      numpad.setAttribute('visible', true)
      numpad.querySelector('*[shelf]').setAttribute('shelf', 'name', this.data.tooltip)
      if (this.data.type === 'number' || this.data.autoClear)
      {
        this.setValue("", {update: false})
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

  // Directly sets the value of the edit field to `value`
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
      this.setValue(existingValue + buttonValue, {update: false})
    }
  },

  // Backspaces the edited text
  backspace(e) {
    this.setValue(this.el.getAttribute('text').value.slice(0, -1), {update: false})
  },

  // Accepts the edit field popup
  ok(e) {
    this.setValue(this.el.getAttribute('text').value)
    this.el.components['popup-button'].closePopup()
    this.el.emit("editfinished", {value: this.el.getAttribute('text').value})
  },

  // Clears the popup text
  clear(e) {
    this.setValue("")
  },

  // Pastes to the edit field
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
    scale: {type: 'vec3', default: new THREE.Vector3(1, 1, 1)},

    offset: {type: 'vec3', default: new THREE.Vector3(0, 0, 0.1)},

    autoScale: {default: false},

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
    if (!this.el.hasAttribute('icon-button'))
    {
      this.el.append(popup)
    }
    else {
      this.el.parentEl.append(popup)
    }

    this.popup = popup

    popup.setAttribute('position', '0 0 0.1')
    popup.setAttribute('visible', 'false')

    popup.addEventListener('click', e => {
      if (!e.target.hasAttribute('popup-action')) return

      this[e.target.getAttribute('popup-action') + "Popup"]()

      // e.stopPropagation()
    })

    popup.addEventListener('popupaction', e => {
      this[e.detail + "Popup"]()
      e.stopPropagation()
      console.log("Trying to stop propogation", this.el, e)
    })
  },
  update(oldData) {
    if (this.data.tooltip)
    {
      this.editButton.setAttribute('tooltip', this.data.tooltip)
    }
    if (this.data.popup !== oldData.popup && !this.data.deferred)
    {
      console.debug("Resetting popup HTML", this.data.popup, oldData.popup)
      for (let c of this.popup.children) {
        this.popup.remove(c)
      }
      let child = document.createElement('a-entity')
      for (let c of this.popup.children)
      {
        this.popup.removeChild(c)
      }
      this.popup.append(child)
      child.innerHTML = require(`./partials/${this.data.popup}.html.slm`)
      this.popupLoaded = true
    }
    if (!this.popupLoaded && !this.data.deferred)
    {
      console.debug("Initing popup", this.data.deferred, this.data);
      for (let c of this.popup.children) {
        this.popup.remove(c)
      }
      let child = document.createElement('a-entity')
      this.popup.append(child)
      child.innerHTML = require(`./partials/${this.data.popup}.html.slm`)
      this.popupLoaded = true
    }
  },

  // Launches the popup
  launchPopup() {
    let popup = this.popup
    if (!this.popupLoaded)
    {
      popup.innerHTML = require(`./partials/${this.data.popup}.html.slm`)
      this.popupLoaded = true
    }
    if (!this.shelfPopup && popup.children.length === 1 && popup.children[0].hasAttribute('shelf'))
    {
      this.shelfPopup = popup.children[0]
      Util.whenLoaded(this.shelfPopup, () => {
        this.shelfPopup.setAttribute('shelf', 'popup', true)
        this.shelfPopup.addEventListener('popupaction', e => {
          this.popup.emit('popupaction', e.detail)
          e.stopPropagation()
        })
      })
    }
    popup.object3D.position.copy(this.data.offset)
    popup.object3D.updateMatrixWorld()

    if (!this.data.autoScale)
    {
      let invScale =  popup.object3D.parent.getWorldScale(new THREE.Vector3())
      invScale.x = this.data.scale.x / invScale.x
      invScale.y = this.data.scale.y / invScale.y
      invScale.z = this.data.scale.z / invScale.z
      popup.object3D.scale.copy(invScale)
    }

    popup.setAttribute('visible', true)
    this.el.sceneEl.emit('refreshobjects')
    this.el.emit('popuplaunched')
    if (this.shelfPopup)
    {
      Util.whenLoaded(this.shelfPopup, () => this.shelfPopup.emit('popupshown'))
    }
    else
    {
      popup.emit('popupshown')
    }
  },

  // Closes the popup
  closePopup() {
    this.popup.setAttribute('visible', false)
    this.popup.setAttribute('position', '0 -999999 0.1')
    this.el.emit('popupclosed');
    (this.shelfPopup || this.popup).emit('popuphidden')
  }
})

// Prevents this elements object or any descendent from being frustum culled.
// Useful to prevent, e.g., disappearing skinned meshes or text fields.
AFRAME.registerComponent('not-frustum-culled', {
  events: {
    object3dset: function(e) {
      this.el.object3D.traverse(o => o.frustumCulled = false)
    }
  },
  init() {
    this.el.object3D.frustumCulled = false
  }
})

// Quick and dirty one-way-bind. Updates to `source`'s `sourceComponent`
// `sourceProperty` are propogated to `target`'s `component` `property`
AFRAME.registerComponent('v-bind', {
  multiple: true,
  schema: {
    target: {type: 'selector'},
    component: {type: 'string'},
    property: {type: 'string'},

    source: {type: 'selector'},
    sourceComponent: {type: 'string'},
    sourceProperty: {type: 'string'},
  },
  init() {
    this.handleUpdate = this.handleUpdate.bind(this)
  },
  update(oldData) {
    let source = this.data.source || this.el.sceneEl

    if (source !== this.source)
    {
      if (this.source)
      {
        this.source.removeEventListener('componentchanged', this.handleUpdate)
      }
      source.addEventListener('componentchanged', this.handleUpdate)
      this.source = source
    }
    this.forceUpdate()
  },
  handleUpdate(e) {
    if (e.detail.name === this.data.sourceComponent)
    {
      this.forceUpdate()
    }
  },
  forceUpdate() {
    let val = this.data.source.getAttribute(this.data.sourceComponent)
    val = this.data.sourceProperty ? val[this.data.sourceProperty] : val
    let target = this.data.target || this.el
    target.setAttribute(this.data.component, this.data.property ? this.data.property : val, this.data.property ? val : undefined)
  }
})

AFRAME.registerComponent('dropdown-button', {
  schema: {
    options: {type: 'array'},

    optionIcon: {type: 'string', default: '#asset-record'},
    tooltip: {default: 'Select'},

    // [Optional] If set, will edit another elements component property
    target: {type: 'selector'},
    // If `target` is set, this is the component to edit
    component: {type: 'string'},
    // If `target` is set, this is the property to edit
    property: {type: 'string'},

    selectedValue: {type: 'string'}
  },
  events: {
    popuplaunched: function(e) {
      this.populatePopup()
    }
  },
  init() {
    this.el.setAttribute('popup-button', 'popup: dropdown-popup')


    Util.whenLoaded(this.data.target ? [this.data.target, this.el] : this.el, () => {
      if (this.data.target)
      {
        this.data.selectedValue = this.data.property ? this.data.target.getAttribute(this.data.component)[this.data.property]
                                                     : this.data.target.getAttribute(this.data.component)

      }

      if (this.el.hasAttribute('text'))
      {
        this.el.setAttribute('text', 'value', this.data.selectedValue)
      }
    })
  },
  populatePopup() {
    console.log("Populating popup", this.data.options)
    let popup = this.el.components['popup-button'].popup
    let content = popup.querySelector('*[shelf-content]')
    content.getChildEntities().forEach(el => content.removeChild(el))
    let maxLength = Math.max.apply(Math, this.data.options.map(o => o.length))
    for (let option of this.data.options)
    {
      let row = document.createElement('a-entity')
      content.append(row)
      row.setAttribute('icon-row', '')
      let button = document.createElement('a-entity')
      row.append(button)
      button.setAttribute('icon-button', this.data.optionIcon)

      if (this.data.target)
      {
        button.setAttribute('radio-button', {value: option, target: this.data.target, component: this.data.component, property: this.data.property})
      }
      else
      {
        if (option === this.data.selectedValue)
        {
          button.setAttribute('toggle-button', 'toggled', 'true')
        }
      }

      button.addEventListener('click', (e) => {
        this.el.emit('dropdownoption', option)
        this.el.setAttribute('dropdown-button', 'selectedValue', option)

        if (this.el.hasAttribute('text')) {
          this.el.setAttribute('text', 'value', option)
        }
      })

      button.setAttribute('popup-action', 'close')

      let label = document.createElement('a-entity')
      row.append(label)
      label.setAttribute('text', `wrapCount: ${maxLength + 3}; width: 1.5; anchor: left; align: left`)
      label.setAttribute('text', 'value', option)
      label.setAttribute('position', '0.4 0 0')
    }
  }
})
