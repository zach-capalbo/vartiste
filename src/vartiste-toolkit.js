console.log("including VARTISTE toolkit")
require('./shelf')
require('./icon-button')
require('./edit-field')
require('./popup-shelf')
require('./tooltip')
require('./frame')
require('./optimization-components')
require('./speech')
require('./matcap-shader')
require('./desktop-controls')
require('./manipulator')
require('./canvas-shader-processor')
require('./canvas-updater')
require('./demo-overlay')
require('./joystick-directions')
require('./popup-shelf')
require('./smooth-controller')
// require('./user-media')
const {Undo} = require('./undo')
const {Pool} = require('./pool')
const materialTransformations = require('./material-transformations')
window.VARTISTE = {}
VARTISTE.Util = require('./util.js')


AFRAME.registerComponent('vartiste-user-root', {
  init() {
    this.el.innerHTML = require('./partials/artist-root.html.slm')
  }
})

AFRAME.registerSystem('vartiste-assets', {
  init() {
    let assets = this.el.sceneEl.querySelector('a-assets')

    if (!assets)
    {
      assets = document.createElement('a-assets')
      this.el.sceneEl.append(assets)
    }

    if (!assets.querySelector('#asset-shelf'))
    {
      let shelfTexture = document.createElement('img')
      shelfTexture.src = require('./assets/shelf.png')
      shelfTexture.id = "asset-shelf"
      assets.append(shelfTexture)
    }
  }
})
