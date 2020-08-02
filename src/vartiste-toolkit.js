console.log("including VARTISTE toolkit")

if (document.currentScript)
{
  window.VARTISTE_TOOLKIT_URL = document.currentScript.src.split('/').slice(0, -1).join("/")
}

const {loadAsset, loadAllAssets} = require('./assets.js')

AFRAME.registerSystem('vartiste-assets', {
  init() {
    let assets = this.el.sceneEl.querySelector('a-assets')

    if (!assets)
    {
      assets = document.createElement('a-assets')
      this.el.sceneEl.append(assets)
    }

    if (assets.querySelector('*[vartiste-assets]'))
    {
      loadAllAssets()
    }

    if (!assets.querySelector('#asset-shelf'))
    {
      assets.append(loadAsset('./shelf.png'))
    }

    if (!assets.querySelector('#asset-hand-right'))
    {
      assets.append(loadAsset('./hand-right.png'))
    }

    if (!assets.querySelector('#asset-matcap'))
    {
      assets.append(loadAsset('./matcap.jpg'))
    }

    if (!assets.querySelector('#asset-hand'))
    {
      assets.append(loadAsset('./hand.glb'))
    }

    if (!assets.querySelector('#asset-close-circle-outline'))
    {
      assets.append(loadAsset('./close-circle-outline.png'))
    }

  }
})

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
