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
  dependencies: ["text", "popup-button"],
  schema: {
    // Tooltip to go on the edit button
    tooltip: {type: 'string'},

    // What kind of keyboard to pop up. Either 'number', 'string', or 'dropdown'
    type: {type: 'string', default: 'number', oneOf: ['number', 'float', 'string', 'dropdown']},

    // [Optional] If set, will edit another elements component property
    target: {type: 'selector'},
    // If `target` is set, this is the component to edit
    component: {type: 'string'},
    // If `target` is set, this is the property to edit
    property: {type: 'string'},

    // When true, this will clear the current value of the property when editing
    // (mainly to avoid the user having to backspace everything)
    autoClear: {type: 'boolean', default: false},

    // For float types, pick a fixed number of decimals to round to
    toFixed: {default: -1}
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
      if (this.data.type === 'number' || this.data.type === 'float' || this.data.autoClear)
      {
        this.setValue("", {update: false})
      }
    })
  },
  update(oldData) {
    let popupType = 'numpad'
    if (this.data.type === 'string') popupType = 'keyboard'
    if (this.data.type === 'float') popupType = 'numpad-float'
    this.el.setAttribute('popup-button', {
      icon: "#asset-lead-pencil",
      tooltip: this.data.tooltip,
      popup: popupType,
      deferred: true,
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
            if (this.data.type === 'float' && this.data.toFixed > 0)
            {
              this.setValue(this.data.target.getAttribute(this.data.component)[this.data.property].toFixed(this.data.toFixed), {update: false})
            }
            else
            {
              this.setValue(this.data.target.getAttribute(this.data.component)[this.data.property].toString(), {update: false})
            }
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
    let numpad = this.numpad.querySelector('.value')
    if (numpad) numpad.setAttribute('text', {value})
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
      if (buttonValue === "")
      {
        buttonValue = " "
      }
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
  // dependencies: ["text"],
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
    deferred: {type: 'boolean', default: true}
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
    if (this.data.deferred && this.popupLoaded && this.data.popup !== oldData.popup)
    {
      this.popupLoaded = false
      for (let c of this.popup.children) {
        this.popup.remove(c)
      }
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
    if (this.shelfPopup)
    {
      Util.whenLoaded(this.shelfPopup, () => {
        this.el.sceneEl.emit('refreshobjects')
        this.el.emit('popuplaunched', popup)
        this.shelfPopup.emit('popupshown')
      })
    }
    else
    {
      this.el.sceneEl.emit('refreshobjects')
      popup.emit('popupshown')
      this.el.emit('popuplaunched')
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
// `sourceProperty` are propogated to `target`'s `component` `property`.
AFRAME.registerComponent('v-bind', {
  multiple: true,
  schema: {
    // The entity containing the component property to be bound.
    target: {type: 'selector'},
    // The component containing the property to be bound.
    component: {type: 'string'},
    // The property to be bound.
    property: {type: 'string'},

    // The entity containing the component property the target will bind to
    source: {type: 'selector'},
    // The component containing the property the target will bind to
    sourceComponent: {type: 'string'},
    // The property the target property will bind to
    sourceProperty: {type: 'string'},

    // When set to true, the target property will be set to the same value
    // as the sourceProperty when it loads
    setOnLoad: {default: false},
  },
  init() {
    this.handleUpdate = this.handleUpdate.bind(this)
    if (this.data.setOnLoad)
    {
      Util.whenLoaded([this.el, this.data.source], () => {
        this.forceUpdate()
      })
    }
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

    // [Optional]
    labels: {type: 'array'},

    optionIcon: {type: 'string', default: '#asset-record'},
    tooltip: {default: 'Select'},

    // [Optional] If set, will edit another elements component property
    target: {type: 'selector'},
    // If `target` is set, this is the component to edit
    component: {type: 'string'},
    // If `target` is set, this is the property to edit
    property: {type: 'string'},

    selectedValue: {type: 'string'},

    showActiveOptionTooltip: {default: false},
  },
  events: {
    popuplaunched: function(e) {
      this.populatePopup()
    }
  },
  emits: {
    dropdownoption: {}
  },
  init() {
    this.el.setAttribute('popup-button', 'popup: dropdown-popup')


    Util.whenLoaded(this.data.target ? [this.data.target, this.el] : this.el, () => {
      if (this.data.target)
      {
        this.el.setAttribute('dropdown-button', 'selectedValue', this.data.property ? this.data.target.getAttribute(this.data.component)[this.data.property]
                                                                                    : this.data.target.getAttribute(this.data.component))

      }

      if (this.el.hasAttribute('text'))
      {
        this.el.setAttribute('text', 'value', this.data.selectedValue)
      }
    })
  },
  update(oldData) {
    if (!this.data.showActiveOptionTooltip && oldData.showActiveOptionTooltip)
    {
      this.el.removeAttribute("tooltip__dropdown")
    }

    if (this.data.showActiveOptionTooltip && this.data.selectedValue !== oldData.selectedValue)
    {
      this.el.setAttribute('tooltip__dropdown', this.data.selectedValue)
      this.el.setAttribute('tooltip-style', '')
      this.el.setAttribute('tooltip-style__dropdown', "offset: 0, -0.8 0; wrapCount: 14")
    }
  },
  populatePopup() {
    let options = this.data.options
    let labels = this.data.labels
    if (!options || options.length === 0)
    {
      options = AFRAME.components[this.data.component].schema[this.data.property].oneOf;
    }
    console.log("Populating popup", options)

    let popup = this.el.components['popup-button'].popup
    let shelf = popup.querySelector('*[shelf]')
    shelf.setAttribute('shelf', 'height', Math.max(2, options.length * 0.5 + 0.3))
    let content = popup.querySelector('*[shelf-content]')
    content.getChildEntities().forEach(el => content.removeChild(el))
    let maxLength = Math.max(...options.map(o => o.length), ...labels.map(o => o.length))
    for (let i in options)
    {
      let option = options[i]
      let labelText = option
      if (labels.length > i)
      {
        labelText = this.data.labels[i]
      }
      let row = document.createElement('a-entity')
      content.append(row)
      row.setAttribute('icon-row', '')
      let button = document.createElement('a-entity')
      row.append(button)

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
      button.setAttribute('icon-button', this.data.optionIcon)

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
      label.setAttribute('text', 'value', labelText)
      label.setAttribute('position', '0.4 0 0')
    }
  }
})

AFRAME.registerComponent('deferred-load', {
  schema: {
    loaded: {default: false},
    onVisible: {default: false},

    popup: {type: 'string', default: ''}
  },
  events: {
    componentchanged: function(e) {
      if (e.detail.name === 'visible')
      {
        if (this.data.onVisible && this.el.getAttribute('visible'))
        {
          this.load()
        }
      }
    }
  },
  update(oldData)
  {
    if (this.data.loaded) this.load();
  },
  load() {
    if (this.loaded) return;

    if (this.data.popup.length)
    {
      this.el.innerHTML = require(`./partials/${this.data.popup}.html.slm`)
      return
    }

    let script = this.el.querySelector('script')

    console.log("Loading script", script, this.el)

    this.el.innerHTML = script.text

    this.loaded = true;
  }
})
