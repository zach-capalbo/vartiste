import {Sfx} from './sfx.js'
import {Util} from './util.js'

const DEFAULT_BUTTON_STYLE_SCHEMA = {
  color: {type: 'color', default: "#abe"},
  clickColor: {type: 'color', default: '#aea'},
  intersectedColor: {type: 'color', default: '#cef'},
  toggleOnColor: {type: 'color', default: '#bea'},
  keepAspect: {type: 'bool', default: true},
  buttonType: {default: 'button'}
}

const DEFAULT_BUTTON_STYLE = {}
for (let k in DEFAULT_BUTTON_STYLE_SCHEMA) {
  DEFAULT_BUTTON_STYLE[k] = DEFAULT_BUTTON_STYLE_SCHEMA[k].default
}

// Allows you to set the styling for an `icon-button`.
//
// E.g.: `<a-entity icon-button="#my-icon" button-style="color: blue"></a-entity>`
AFRAME.registerComponent('button-style', {
  schema: {
    color: {type: 'color', default: "#abe"},
    clickColor: {type: 'color', default: '#aea'},
    intersectedColor: {type: 'color', default: '#cef'},
    toggleOnColor: {type: 'color', default: '#bea'},

    // If true, preserves icon image aspect ratio
    keepAspect: {type: 'bool', default: true},

    // Either 'flat' or 'button'
    buttonType: {default: 'button'}
  }
})

const [
  STATE_NORMAL,
  STATE_HOVERED,
  STATE_PRESSED,
  STATE_TOGGLED
] = [
  "BUTTON_STATE_NORMAL",
  "BUTTON_STATE_HOVERED",
  "BUTTON_STATE_PRESSED",
  "BUTTON_STATE_TOGGLED"
]

// System to handle caching and sharing of materials for icon buttons. At the
// moment, it is best not to change these values dynamically.
AFRAME.registerSystem('icon-button', {
  schema: {
    shader: {default: 'matcap'},
    iconShader: {default: 'flat'},
    matcap: {default: '#asset-matcap', type: 'map'},
    metalness: {default: 0.3},
    roughness: {default: 1.0}
  },
  init() {
    this.width = 0.4
    this.depth = 0.05
    this.geometry = new THREE.BoxBufferGeometry(this.width, this.width, this.depth - 0.005)
    this.frontGeometry = new THREE.PlaneBufferGeometry(this.width, this.width)
    this.colorManagement = this.el.getAttribute('renderer').colorManagement;

    this.blankFaceMaterial = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0,
      alphaTest: 0.01
    })
    this.faceMaterials = {}

    this.bgMaterials = {}

    if (this.data.shader === 'matcap')
    {
      this.bgMaterial = new THREE.MeshMatcapMaterial()
      this.bgMaterial.matcap = new THREE.Texture()
      this.bgMaterial.matcap.image = this.data.matcap
      this.bgMaterial.matcap.encoding = THREE.LinearEncoding
      this.bgMaterial.matcap.needsUpdate = true
    }
    else if (this.data.shader === 'standard')
    {
      this.bgMaterial = new THREE.MeshStandardMaterial({metalness: 0.3, roughness: 1.0})
    }
    else
    {
      this.bgMaterial = new THREE.MeshBasicMaterial()
    }

    this.tmpColor = new THREE.Color()
  }
})

// Creates a square, clickable button with an icon on front.
//
// #### Usage Notes
//
// - Multiple `icon-button` will automatically arrange themselves in a row
// depending on how many siblings it has in its parent element.
// - `icon-button` has an implicit [`propogate-grab`](#propogate-grab), so
//   placing them as children of a grabbable entity will automatically redirect
//   grabs of the icon-button to the grabbable parent.
AFRAME.registerComponent('icon-button', {
  dependencies: ['button-style'],

  // Should be a selector for an image asset, or a texture map (anything that
  // can go into a `material` `map` property should work)
  schema: {type:'string', default: ""},
  events: {
    stateadded: function(e) { this.updateStateColor() },
    stateremoved: function(e) { this.updateStateColor() },
    componentchanged: function(e) { if (e.detail.name === 'button-style') this.updateStateColor() },
    'raycaster-intersected': function(e) { this.el.addState(STATE_HOVERED)},
    'raycaster-intersected-cleared': function(e) { this.el.removeState(STATE_HOVERED)},
  },
  init() {
    let width = this.system.width
    let height = width
    let depth = this.system.depth

    this.state = STATE_NORMAL

    let buttonStyle
    if (this.el.hasAttribute('button-style'))
    {
       buttonStyle = this.el.getAttribute('button-style')
    }
    else
    {
      buttonStyle = DEFAULT_BUTTON_STYLE
    }

    this.style = buttonStyle

    if (buttonStyle.buttonType === 'plane')
    {
      depth = 0.001
    }

    this.el.setObject3D('mesh', new THREE.Mesh(this.system.frontGeometry, this.system.blankFaceMaterial))
    // this.el.setObject3D('mesh', new THREE.Mesh(this.system.frontGeometry, new THREE.MeshStandardMaterial({transparent: true, fog: false)))

    // Inline propogate-grab
    for (let parent = this.el.parentEl; parent; parent = parent.parentEl)
    {
      if (parent['redirect-grab'] || parent.classList.contains('clickable') || parent.classList.contains('grab-root'))
      {
        this.el['redirect-grab'] = parent
        break;
      }
    }

    this.el.classList.add('clickable')

    let indexId = Array.from(this.el.parentEl.children).filter(e => e.hasAttribute('icon-button')).indexOf(this.el)
    this.el.object3D.position.z += depth
    this.el.object3D.position.x += (width + 0.05) * indexId

    let bg;
    if (buttonStyle.buttonType === 'plane')
    {
      bg = new THREE.Mesh(this.system.frontGeometry, this.system.bgMaterial)
      bg.position.set(0,0,- 0.01)
    }
    else
    {
      bg = new THREE.Mesh(this.system.geometry, this.system.bgMaterial)
      bg.position.set(0,0,- depth / 2)
    }

    this.el.getObject3D('mesh').add(bg)
    this.bg = bg

    this.el.addEventListener('click', (e) => {
      this.clickTime = this.el.sceneEl.time
      if (e.detail.cursorEl)
      {
        Sfx.click(e.detail.cursorEl)
      }
      this.addState(STATE_PRESSED)
      //this.setColor(buttonStyle.clickColor)
    })

    this.el.addEventListener('object3dset', (e) => {
      this.updateAspect()
      this.updateStateColor()
    })

    this.updateStateColor()

    this.el.actionTooltips = {trigger: 'Click Button'}

    this.tick = AFRAME.utils.throttleTick(this.tick, 80, this)
  },
  update(oldData) {
    if (this.system.faceMaterials[this.data])
    {
      this.el.getObject3D('mesh').material = this.system.faceMaterials[this.data]
    }
    else
    {
      this.el.setAttribute('material', {
        alphaTest: 0.01,
        color: '#FFF',
        fog: false,
        src: this.data,
        transparent: true,
        shader: this.system.data.iconShader,
        opacity: this.data === "" ? 0.0 : 1.0
      })

      if (!((this.data instanceof HTMLImageElement) || this.data.startsWith("data")))
      {
        this.system.faceMaterials[this.data] = this.el.getObject3D('mesh').material
      }
    }
    this.updateAspect()
  },
  addState(state) {
    this.el.addState(state)
  },
  removeState(state) {
    this.el.removeState(state)
  },
  updateStateColor() {
    if (this.el.is(STATE_PRESSED))
    {
      this.setColor(this.style.clickColor)
      return
    }
    if (this.el.is(STATE_HOVERED))
    {
      this.setColor(this.style.intersectedColor)
      return
    }
    if (this.el.is(STATE_TOGGLED))
    {
      this.setColor(this.style.toggleOnColor)
      return
    }

    this.setColor(this.style.color)
  },
  setColor(color) {
    let threeColor = this.system.tmpColor
    threeColor.setStyle(color)
    if (this.system.colorManagement) threeColor.convertSRGBToLinear()

    if (this.system.bgMaterials[threeColor.getHex()])
    {
      this.bg.material = this.system.bgMaterials[threeColor.getHex()]
    }
    else
    {
      this.bg.material = this.system.bgMaterial.clone()
      this.bg.material.color.copy(threeColor)
      this.bg.material.needsUpdate = true
      this.system.bgMaterials[threeColor.getHex()] = this.bg.material
    }

    // this.bg.material.needsUpdate = true
  },
  updateAspect() {
    return
    if (this.style && this.style.keepAspect)
    {
      let material = this.el.getObject3D('mesh').material
      if (!material || !material.map) return
      let img = material.map.image
      let aspect = img.width / img.height
      // this.el.setAttribute('geometry', {height: 0.4 / aspect})
    }
  },
  tick(t,ts) {
    if (this.clickTime)
    {
      if (t - this.clickTime > 300) {
        let buttonStyle = this.el.components['button-style'].data
        this.removeState(STATE_PRESSED)
      }
    }
  }
})

// Turns an [`icon-button`](#icon-button) into a toggleable button. Can store
// the toggle state internally, or set and track a property on a component.
AFRAME.registerComponent('toggle-button', {
  dependencies: ['icon-button'],
  schema: {
    // Which element contains the component to set the property on
    target: {type: 'selector'},
    // Which component to set the property on
    component: {type: 'string'},
    // Which property to toggle
    property: {type: 'string'},

    // State of being toggled, when not using target and component
    toggled: {type: 'boolean', default: false}
  },
  events: {
    click: function() {
      if (this.data.target)
      {
        if (this.data.property)
        {
          this.data.target.setAttribute(this.data.component, {[this.data.property]: !this.data.target.getAttribute(this.data.component)[this.data.property]})
        }
        else
        {
          this.data.target.setAttribute(this.data.component, !this.data.target.getAttribute(this.data.component))
        }
      }
      else if (this.data.system)
      {
        this.el.sceneEl.systems[this.data.system].data[this.data.property] = !this.el.sceneEl.systems[this.data.system].data[this.data.property]
        this.setToggle(this.el.sceneEl.systems[this.data.system].data[this.data.property])
      }
      else
      {
        this.data.toggled = !this.data.toggled
        this.setToggle(this.data.toggled)
      }
    }
  },
  update(oldData) {
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
            this.setToggle(!!this.data.target.getAttribute(this.data.component)[this.data.property], {update: false})
          }
        }
        this.data.target.addEventListener('componentchanged', this.componentchangedlistener)

        Util.whenLoaded([this.el, this.data.target], () => {
          this.setToggle(!!this.data.target.getAttribute(this.data.component)[this.data.property], {update: false})
        })
      }
      else
      {
        if (this.data.toggled !== oldData.toggled)
        {
          this.setToggle(this.data.toggled)
        }
      }
    }
  },
  setToggle(value) {
    this.data.toggled = value
    if (value)
    {
      this.el.addState(STATE_TOGGLED)
      this.el.components['icon-button'].updateStateColor()
    }
    else
    {
      this.el.removeState(STATE_TOGGLED)
    }
  }
})

// Calls a method of a system or system-component (a component on the scene
// element) when the element recieves a `click` event.
AFRAME.registerComponent('system-click-action', {
  schema: {
    // You should set either system or component
    system: {type: 'string'},
    // You should set either system or component
    component: {type: 'string'},

    // The name of the method to call when clicked
    action: {type: 'string'}
  },
  events: {
    click: function() {
      console.log("Clicking", this)

      if (this.data.component)
      {
        this.el.sceneEl.components[this.data.component][this.data.action]()
      }
      else
      {
        this.el.sceneEl.systems[this.data.system][this.data.action]()
      }
    }
  }
})

// Automatically arrange multply rows of `icon-button`s. This will set its
// y-position based on how many icon-rows there are before it in the parent
// element.
AFRAME.registerComponent('icon-row', {
  init() {
    let indexId = Array.from(this.el.parentEl.children).filter(e => e.hasAttribute('icon-row')).indexOf(this.el)
    this.el.object3D.position.y -= (0.4 + 0.1) * indexId
  }
})
