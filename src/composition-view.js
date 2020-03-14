AFRAME.registerComponent('forward-draw', {
  schema: {type: 'selector'},
  update() {
    this.target = this.data.components['draw-canvas']
  },
  drawUV(...args) {
    this.target.drawUV(...args)
  },
  pickColorUV(...args) {
    return this.target.pickColorUV(...args)
  },
  eraseUV(...args) {
    this.target.eraseUV(...args)
  }
})

AFRAME.registerComponent('composition-view', {
  dependencies: ['gltf-model'],
  schema: {
    compositor: {type: 'selector'}
  },
  init() {
    this.el.classList.add('canvas')

    if (!this.data.compositor.hasLoaded)
    {
      this.data.compositor.addEventListener('loaded', e => this.setupCanvas())
    }
    else
    {
      this.setupCanvas()
    }

    this.el.addEventListener('object3dset', e => this.updateMesh())
    this.data.compositor.addEventListener('componentchanged', e => { if (e.detail.name === 'material') this.updateMesh() })
    this.el.addEventListener('updatemesh', e => this.updateMesh())

    // this.setAttribute("draw-canvas", {canvas: this.compositor.canvasthing})
  },
  setupCanvas(){
    console.log("SetupCanvas")
    this.compositor = this.data.compositor.components.compositor
    let {compositor} = this
    this.el.setAttribute('forward-draw', this.data.compositor)
  },
  updateMesh() {
    if (!this.el.getObject3D('mesh')) return

    this.el.getObject3D('mesh').traverse(o => {
      if (o.type == "Mesh" || o.type == "SkinnedMesh") { o.material = this.data.compositor.getObject3D('mesh').material}
    })
  }
})
