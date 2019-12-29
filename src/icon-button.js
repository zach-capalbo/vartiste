AFRAME.registerComponent('icon-button', {
  dependencies: ['material'],
  schema: {type:"string"},
  init() {
    let width = 0.4
    let height = width
    let depth = 0.05
    this.el.setAttribute('material', {
      alphaTest: 0.01,
      color: '#FFF',
      fog: false,
      src: this.data
    })
    this.el.setAttribute('geometry', {
      primitive: 'plane',
      width: height,
      height: width
    })
    let indexId = Array.from(this.el.parentEl.childNodes).filter(e => e.getAttribute('icon-button')).indexOf(this.el)
    console.log(this.el, indexId)
    this.el.object3D.position.z += depth
    this.el.object3D.position.x += (width + 0.05) * indexId

    var bg = document.createElement('a-entity')
    bg.setAttribute('material', 'shader: standard; color: #abe; metalness: 0.3')
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
      this.clickTime = e.timeStamp
      this.bg.setAttribute('material', {color: '#aea'})
    })

    this.el.addEventListener('raycaster-intersected', (e) => {
      if (!this.clickTime) {
        this.bg.setAttribute('material', {color: '#cef'})
      }
    })
    this.el.addEventListener('raycaster-intersected-cleared', (e) => {
      if (!this.clickTime) {
        this.bg.setAttribute('material', {color: '#abe'})
      }
    })
  },
  tick(t,ts) {
    if (this.clickTime)
    {
      if (t - this.clickTime > 500) {
        this.bg.setAttribute('material', {color: "#abe"})
      }
    }
  }
})
