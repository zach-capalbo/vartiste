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
  },
  newCompositionAction(e) {
    let compositor = document.getElementById('canvas-view').components.compositor;
    let {width, height} = AFRAME.utils.styleParser.parse(e.target.getAttribute('size'))
    console.log("WH", width, height, AFRAME.utils.styleParser.parse(e.target.getAttribute('size')), e.target.getAttribute('size'))
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
  }
})
