console.log("including VARTISTE toolkit")

if (document.currentScript)
{
  window.VARTISTE_TOOLKIT_URL = document.currentScript.src.split('/').slice(0, -1).join("/")
}

const {loadAsset, loadAllAssets} = require('./assets.js')

// Loads VARTISTE assets
//
// If there is an `a-assets` in the scene, and it contains a `vartiste-assets`
// element, then all of the VARTISTE assets will be loaded. Otherwise only the
// essential assets for the toolkit components will be loaded.
//
// *Note,* any existing assets will be kept, so you can override any VARTISTE
// assets by including an element with the same id as the asset to override in
// your `a-assets`.
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
require('./draw-canvas')
require('./hand-draw-tool')
require('./paint-system')
require('./color-picker')
const {ButtonMaps, Axes, JoystickDirections} = require('./joystick-directions.js')
// require('./user-media')
const {Undo} = require('./undo')
const {Pool} = require('./pool')
const materialTransformations = require('./material-transformations')
window.VARTISTE = {}
VARTISTE.Util = require('./util.js')
Object.assign(VARTISTE, {ButtonMaps, Axes, JoystickDirections, Pool, Undo})

// Applies the base VARTISTE button mapping for the manipulator and rotation
AFRAME.registerComponent('vartiste-rotation-button-mapping', {
  dependencies: ['raycaster', 'laser-controls'],
  init() {
    let buttonMap = new ButtonMaps()

    buttonMap.setMap({
      'abutton': buttonMap.toggle('rotating'),
      'trackpad': buttonMap.toggle('rotating'),
      'thumbstick': buttonMap.toggle('orbiting')
    }, "grabbing")

    buttonMap.install(this)
  },
})

// Applies the VARTISTE user setup, including camera and controller components
AFRAME.registerComponent('vartiste-user-root', {
  init() {
    this.el.innerHTML = require('./partials/artist-root.html.slm')
    this.el.querySelector('#right-hand').setAttribute('joystick-turn', "target: #artist-root")


  }
})
