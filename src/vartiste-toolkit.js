console.log("including VARTISTE toolkit")

if (document.currentScript)
{
  window.VARTISTE_TOOLKIT_URL = document.currentScript.src.split('/').slice(0, -1).join("/")
}

if (window.VARTISTE_TOOLKIT && window.VARTISTE_TOOLKIT.assetUrl)
{
  window.VARTISTE_TOOLKIT_URL = VARTISTE_TOOLKIT.assetUrl
}

window.VARTISTE_TOOLKIT = Object.assign({
  includeFiles: undefined,
  excludeFiles: [],
  includeComponents: undefined,
  excludeComponents: [],

}, window.VARTISTE_TOOLKIT || {})

VARTISTE_TOOLKIT.excludeFiles = VARTISTE_TOOLKIT.excludeFiles.map(f => f.match(/\.?\/?(.*?)\.?j?s?$/)[1])

const {loadAsset, loadAllAssets} = require('./assets.js')

const originalRegisterComponent = AFRAME.registerComponent
const originalRegisterSystem = AFRAME.registerSystem

AFRAME.registerComponent = function (name, opt) {
  if (VARTISTE_TOOLKIT.includeComponents && !VARTISTE_TOOLKIT.includeComponents.includes(name)) return;
  if (VARTISTE_TOOLKIT.excludeComponents.includes(name)) return;
  return originalRegisterComponent.call(this, name, opt)
}

AFRAME.registerSystem = function (name, opt) {
  if (VARTISTE_TOOLKIT.includeComponents && !VARTISTE_TOOLKIT.includeComponents.includes(name)) return;
  if (VARTISTE_TOOLKIT.excludeComponents.includes(name)) return;
  return originalRegisterSystem.call(this, name, opt)
}

function checkFile (rawName) {
  let name = rawName.match(/\.?\/?(.*?)\.?j?s?$/)[1]
  if (VARTISTE_TOOLKIT.includeFiles && !VARTISTE_TOOLKIT.includeFiles.includes(name)) return false;
  if (VARTISTE_TOOLKIT.excludeFiles.includes(name)) return false;
  return true;
}

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

    if (!assets.querySelector('#asset-reset-orientation'))
    {
      assets.append(loadAsset('./reset-orientation.jpg'))
    }
  }
})

if (checkFile('./framework/valve-index-controls')) require('./framework/valve-index-controls')
if (checkFile('./shelf')) require('./shelf')
if (checkFile('./icon-button')) require('./icon-button')
if (checkFile('./edit-field')) require('./edit-field')
if (checkFile('./popup-shelf')) require('./popup-shelf')
if (checkFile('./tooltip')) require('./tooltip')
if (checkFile('./frame')) require('./frame')
if (checkFile('./optimization-components')) require('./optimization-components')
if (checkFile('./speech')) require('./speech')
if (checkFile('./matcap-shader')) require('./matcap-shader')
if (checkFile('./desktop-controls')) require('./desktop-controls')
if (checkFile('./manipulator')) require('./manipulator')
if (checkFile('./canvas-shader-processor')) require('./canvas-shader-processor')
if (checkFile('./canvas-updater')) require('./canvas-updater')
if (checkFile('./demo-overlay')) require('./demo-overlay')
if (checkFile('./joystick-directions')) require('./joystick-directions')
if (checkFile('./popup-shelf')) require('./popup-shelf')
if (checkFile('./smooth-controller')) require('./smooth-controller')
if (checkFile('./draw-canvas')) require('./draw-canvas')
if (checkFile('./hand-draw-tool')) require('./hand-draw-tool')
if (checkFile('./paint-system')) require('./paint-system')
if (checkFile('./color-picker')) require('./color-picker')
if (checkFile('./leap-hand')) require('./leap-hand')
if (checkFile('./hand-tracking')) require('./hand-tracking')
if (checkFile('./hdri-environment')) require('./hdri-environment')
if (checkFile('./fix-oculus-steamvr')) require('./fix-oculus-steamvr')
if (checkFile('./artist-positioning')) require('./artist-positioning')
if (checkFile('./canvas-fx')) require('./canvas-fx')
const {ButtonMaps, Axes, JoystickDirections} = require('./joystick-directions.js')
// require('./user-media')
const {Undo} = require('./undo')
const {Pool} = require('./pool')
const {MaterialTransformations} = require('./material-transformations')
window.VARTISTE = {}
VARTISTE.Util = require('./util.js').Util
Object.assign(VARTISTE, {ButtonMaps, Axes, JoystickDirections, Pool, Undo, MaterialTransformations})

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

AFRAME.registerComponent = originalRegisterComponent
AFRAME.registerSystem = originalRegisterSystem
