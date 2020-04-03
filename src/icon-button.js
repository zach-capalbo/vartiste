import {Sfx} from './sfx.js'
import {Util} from './util.js'

AFRAME.registerComponent('button-style', {
  schema: {
    color: {type: 'color', default: "#abe"},
    clickColor: {type: 'color', default: '#aea'},
    intersectedColor: {type: 'color', default: '#cef'},
    toggleOnColor: {type: 'color', default: '#abe'},
    keepAspect: {type: 'bool', default: true}
  }
})

AFRAME.registerComponent('icon-button', {
  dependencies: ['material', 'button-style'],
  schema: {type:"string"},
  init() {
    let width = 0.4
    let height = width
    let depth = 0.05

    if (!this.el.hasAttribute('button-style'))
    {
      this.el.setAttribute('button-style', "")
    }

    let buttonStyle = this.el.getAttribute('button-style')
    this.style = buttonStyle

    this.el.setAttribute('material', {
      alphaTest: 0.01,
      color: '#FFF',
      fog: false,
      src: this.data,
      transparent: true
    })

    this.el.setAttribute('geometry', {
      primitive: 'plane',
      width: height,
      height: width
    })

    this.el.setAttribute('propogate-grab', "")

    let indexId = Array.from(this.el.parentEl.childNodes).filter(e => e.hasAttribute('icon-button')).indexOf(this.el)
    this.el.object3D.position.z += depth
    this.el.object3D.position.x += (width + 0.05) * indexId

    var bg = document.createElement('a-entity')
    bg.setAttribute('material', `shader: standard; color: ${buttonStyle.color}; metalness: 0.3; roughness:1.0`)
    bg.setAttribute('geometry', `primitive: box; width: ${width}; height: ${height}; depth: ${depth - 0.001}`)
    bg.setAttribute('position', `0 0 -${depth / 2}`)
    bg.classList.add("clickable")
    bg.addEventListener('click', (e) => {
      e.stopPropagation()
      this.el.emit('click', e.detail)
    })
    bg['redirect-grab'] = this.el
    this.bg = bg
    this.el.append(bg)

    this.el.addEventListener('click', (e) => {
      this.clickTime = this.el.sceneEl.time
      if (e.detail.cursorEl)
      {
        Sfx.click(e.detail.cursorEl)
      }
      this.bg.setAttribute('material', {color: buttonStyle.clickColor})
    })

    this.el.addEventListener('raycaster-intersected', (e) => {
      if (!this.clickTime) {
        this.bg.setAttribute('material', {color: buttonStyle.intersectedColor})
      }
    })
    this.el.addEventListener('raycaster-intersected-cleared', (e) => {
      if (!this.clickTime) {
        this.bg.setAttribute('material', {color: buttonStyle.color})
      }
    })

    this.el.addEventListener('object3dset', (e) => this.updateAspect())
  },
  update(oldData) {
    this.el.setAttribute('material', {
      alphaTest: 0.01,
      color: '#FFF',
      fog: false,
      src: this.data,
      transparent: true,
      opacity: this.data === "" ? 0.0 : 1.0
    })
    this.updateAspect()
  },
  updateAspect() {
    if (this.style && this.style.keepAspect)
    {
      let material = this.el.getObject3D('mesh').material
      if (!material || !material.map) return
      let img = material.map.image
      let aspect = img.width / img.height
      this.el.setAttribute('geometry', {height: 0.4 / aspect})
    }
  },
  tick(t,ts) {
    if (this.clickTime)
    {
      if (t - this.clickTime > 300) {
        let buttonStyle = this.el.getAttribute('button-style')
        this.bg.setAttribute('material', {color: buttonStyle.color})
        this.clickTime = undefined
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
        this.setValue(this.data.toggled)
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
