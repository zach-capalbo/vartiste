AFRAME.registerComponent('button-style', {
  schema: {
    color: {type: 'color', default: "#abe"},
    clickColor: {type: 'color', default: '#aea'},
    intersectedColor: {type: 'color', default: '#cef'}
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
    this.bg = bg
    this.el.append(bg)

    this.el.addEventListener('click', (e) => {
      this.clickTime = this.el.sceneEl.time
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
