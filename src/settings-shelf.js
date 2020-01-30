const settingsShelfHTML = require('./partials/settings-shelf.html.slm')

AFRAME.registerComponent('settings-shelf', {
  init() {
    this.system = this.el.sceneEl.systems['settings-system']
    this.el.innerHTML = settingsShelfHTML

    this.el.addEventListener('click', (e) => {
      let action = e.target.getAttribute("click-action") + 'Action';
      if (action in this)
      {
        this[action](e)
      }
      else if (action in this.system)
      {
        this.system[action]()
      }
    })
    this.el.querySelector('.project-name').addEventListener('editfinished', e=>{
      this.system.setProjectName(e.detail.value)
    })
    this.el.querySelector('.project-name').addEventListener('loaded', e => {
      e.target.setAttribute('text', {value: this.el.sceneEl.systems['settings-system'].projectName})
    })
    this.el.sceneEl.addEventListener('projectnamechanged', e => {
      this.el.querySelector('.project-name').setAttribute('text', {value: this.el.sceneEl.systems['settings-system'].projectName})
    })
    this.el.sceneEl.addEventListener('open-popup', e => {
      this.el.querySelector('.message').setAttribute('text', {value: `${e.detail}`})
    })
  },
  newCompositionAction(e) {
    let compositor = document.getElementById('canvas-view').components.compositor;

    if (e.target.hasAttribute('size'))
    {
      var {width, height} = AFRAME.utils.styleParser.parse(e.target.getAttribute('size'))
      width = parseInt(width)
      height = parseInt(height)
    }
    else
    {
      var width = parseInt(this.el.querySelector('.width').getAttribute('text').value)
      var height = parseInt(this.el.querySelector('.height').getAttribute('text').value)
    }

    if (!(Number.isInteger(width) && width > 0)) throw new Error(`Invalid composition width ${width}`)
    if (!(Number.isInteger(height) && height > 0)) throw new Error(`Invalid composition height ${height}`)

    console.log("Creating new composition", width, height, AFRAME.utils.styleParser.parse(e.target.getAttribute('size')), e.target.getAttribute('size'))
    width = parseInt(width)
    height = parseInt(height)

    for (let layer of compositor.layers)
    {
      compositor.deleteLayer(layer)
    }

    compositor.resize(width, height)

    let ctx = compositor.layers[0].canvas.getContext('2d')
    ctx.fillStyle = "#fff"
    ctx.fillRect(0,0,width,height)
    compositor.addLayer(1)
  },
  resampleAction(e) {
    let compositor = document.getElementById('canvas-view').components.compositor;

    if (e.target.hasAttribute('size'))
    {
      var {width, height} = AFRAME.utils.styleParser.parse(e.target.getAttribute('size'))
      width = parseInt(width)
      height = parseInt(height)
    }
    else
    {
      var width = parseInt(this.el.querySelector('.width').getAttribute('text').value)
      var height = parseInt(this.el.querySelector('.height').getAttribute('text').value)
    }

    if (!(Number.isInteger(width) && width > 0)) throw new Error(`Invalid composition width ${width}`)
    if (!(Number.isInteger(height) && height > 0)) throw new Error(`Invalid composition height ${height}`)

    compositor.resize(width, height, {resample: true})
  },
  toggleShadingAction() {
    let compositor = document.getElementById('canvas-view').components.compositor;

    if (compositor.el.getAttribute('material').shader === 'flat')
    {
      compositor.el.setAttribute('material', {shader: 'standard'})
    }
    else
    {
      compositor.el.setAttribute('material', {shader: 'flat'})
    }
  }
})
