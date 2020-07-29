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

AFRAME.registerComponent('button-style', {
  schema: DEFAULT_BUTTON_STYLE_SCHEMA
})

AFRAME.registerSystem('icon-button', {
  schema: {
    shader: {default: 'standard'},
    matcap: {default: '#asset-matcap'},
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
      this.bgMaterial.matcap.image = document.querySelector('#asset-matcap')
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

AFRAME.registerComponent('icon-button', {
  dependencies: ['button-style'],
  schema: {type:'string', default: ""},
  init() {
    let width = this.system.width
    let height = width
    let depth = this.system.depth

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

    let indexId = Array.from(this.el.parentEl.childNodes).filter(e => e.hasAttribute('icon-button')).indexOf(this.el)
    this.el.object3D.position.z += depth
    this.el.object3D.position.x += (width + 0.05) * indexId

    let bg;
    if (buttonStyle.buttonType === 'plane')
    {
      bg = new THREE.Mesh(this.system.frontGeometry, this.system.bgMaterial)
    }
    else
    {
      bg = new THREE.Mesh(this.system.geometry, this.system.bgMaterial)
    }

    bg.position.set(0,0,- depth / 2)
    this.el.getObject3D('mesh').add(bg)
    this.bg = bg

    this.el.addEventListener('click', (e) => {
      this.clickTime = this.el.sceneEl.time
      if (e.detail.cursorEl)
      {
        Sfx.click(e.detail.cursorEl)
      }
      this.setColor(buttonStyle.clickColor)
    })

    this.el.addEventListener('raycaster-intersected', (e) => {
      if (!this.clickTime) {
        this.setColor(buttonStyle.intersectedColor)
      }
    })
    this.el.addEventListener('raycaster-intersected-cleared', (e) => {
      if (!this.clickTime) {
        this.setColor(buttonStyle.color)
      }
    })

    this.el.addEventListener('object3dset', (e) => this.updateAspect())

    this.setColor(buttonStyle.color)
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
        opacity: this.data === "" ? 0.0 : 1.0
      })

      if (!((this.data instanceof HTMLImageElement) || this.data.startsWith("data")))
      {
        this.system.faceMaterials[this.data] = this.el.getObject3D('mesh').material
      }
    }
    this.updateAspect()
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
        this.setColor(buttonStyle.color)
      }
    }
  }
})

AFRAME.registerComponent('toggle-button', {
  schema: {
    target: {type: 'selector'},
    component: {type: 'string'},
    property: {type: 'string'},
    toggled: {type: 'boolean', default: false}
  },
  events: {
    click: function() {
      if (this.data.target)
      {
        this.data.target.setAttribute(this.data.component, {[this.data.property]: !this.data.target.getAttribute(this.data.component)[this.data.property]})
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
    if (value && !this.alreadyOn)
    {
      this.originalColor = this.el.components['button-style'].data.color
      this.el.setAttribute('button-style', {color: this.el.components['button-style'].data.toggleOnColor})
      this.alreadyOn = true
    }
    else if (!value)
    {
      this.el.setAttribute('button-style', {color: this.originalColor})
      this.alreadyOn = false
    }
    this.data.toggled = value
  }
})

AFRAME.registerComponent('system-click-action', {
  schema: {
    system: {type: 'string'},
    component: {type: 'string'},
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
