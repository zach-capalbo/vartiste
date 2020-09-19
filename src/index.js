// require('./framework/aframe.js')
// require('aframe-environment-component')

// require('aframe-leap-hands');


require('./framework/GLTFExporter.js')
require('./framework/valve-index-controls.js')
require('./framework/hide-in-ar.js')
require('./framework/billboard.js')
require('./framework/fix-lost-controllers.js')

window.Leap = require('leapjs')
require('./framework/leap-hand.js')
require('./hand-tracking');

// require('./framework/three-skip-invisible-update.js')

require('./paint-system')
require('./settings-system')

require('./icon-button')
require('./canvas-updater')
require('./draw-canvas')
require('./right-hand-controls')
require('./left-hand-controls')
require('./hand-draw-tool')
require('./color-picker')
require('./compositor')
require('./manipulator')
require('./shelf')
require('./layer-preview')
require('./layer-shelves')
require('./settings-shelf')
require('./popup-shelf')
require('./file-upload')
require('./edit-field')
require('./tooltip')
require('./brush-shelf')
require('./composition-view')
require('./smooth-controller')
require('./lathe')
require('./url-loader')
require('./pencil-tool')
require('./timeline-shelf.js')
require('./toolbox-shelf.js')
require('./node-connectors.js')
require('./demo-overlay.js')
require('./test-utilities.js')
require('./skeletonator.js')
require('./sketchfab.js')
require('./desktop-controls.js')
require('./about-shelf.js')
require('./frame.js')
require('./environment-manager.js')
require('./networking')
require('./optimization-components')
require('./camera-capture')
require('./timer')
require('./user-media')
require('./speech')
require('./uv-unwrapper')
require('./matcap-shader')
require('./cable-connector')
require('./mesh-tools')
require('./artist-positioning')
require('./fix-oculus-steamvr')

require('./app.styl')

if (location.host === "vartiste.xyz")
{
  // Redirect to gitlab.io for now
  location.href = "https://zach-geek.gitlab.io/vartiste" + location.pathname + location.hash
}

document.write(require('./scene.html.slm'));

const {loadAllAssets} = require('./assets.js')

loadAllAssets()

document.getElementById('right-hand').setAttribute('right-hand-controls', "")
document.getElementById('left-hand').setAttribute('left-hand-controls', "")

document.addEventListener('keydown', e => {
  if (e.key == "r") document.querySelector('a-scene').systems['settings-system'].resetCameraAction()
})

document.getElementById('got-it').addEventListener('click', e => {
  document.getElementById('need-help-notification').classList.add('hidden')
})
