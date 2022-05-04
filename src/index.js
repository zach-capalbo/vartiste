require('file-loader?name=aframe.js!./framework/aframe.js')
// require('aframe-environment-component')
// require('aframe-leap-hands');

require('./loading-page')

require('./framework/geometry-shim.js')

require('./framework/fix-text-autoscaling-logging.js')
require('./framework/GLTFExporter.js')
require('./framework/SVGLoader.js')
// require('./framework/valve-index-controls.js')
require('./framework/hide-in-ar.js')
require('./framework/billboard.js')
require('./framework/fix-lost-controllers.js')

require('./framework/raycast-bvh.js')

// window.Leap = require('leapjs')
require('./leap-hand')
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
require('./desktop-vision.js')
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
require('./volumetrics')
require('./quick-menu')
require('./canvas-fx')
require('./crash-handler')
require('./scalable-raycaster')
require('./physics')
require('./skeletonator-keyframes')
require('./morph-targets')
require('./animation-3d')
require('./webxr-input-profiles')
require('./material-packs')
require('./brush-editor')
require('./ik-solving')
require('./xr-controllers')
require('./manipulator-omni-tool')
require('./kromophone')
require('./xbox-controller.js')
require('./art-physics.js')
require('./busy.js')
require('./avatar.js')
require('./primitive-constructs.js')
require('./sculpting.js')
require('./translation.js')
require('./text')
require('./scene-organizer')
require('./controller-proxy')
require('./extras')
require('./decorators')

require('./hubs-connector-shim.js')

require('./app.styl')

if (location.host === "zach-geek.gitlab.io" && (location.pathname === '/vartiste/' || location.pathname === "/vartiste/index.html") && !location.search.includes("gitlabURL"))
{
  // Redirect to gitlab.io for now
  location.href = "https://vartiste.xyz" + location.hash + location.search
  // location.href = "https://vartiste.xyz" + location.pathname + location.hash + location.search
}

const {loadAllAssets} = require('./assets.js')

// loadAllAssets()
import {Util} from './util.js'

let params = new URLSearchParams(document.location.search)

if (params.get("simplified"))
{
  document.write(require('./simplified-interface.html.slm'))
}
else
{
  document.write(require('./scene.html.slm'));
}

let scene = document.querySelector('a-scene')
if (Util.isLowPower())
{
  scene.setAttribute('renderer', scene.getAttribute('low-power-renderer'))
}

if (!AFRAME.utils.device.isOculusBrowser() && typeof WebXRLayersPolyfill !== 'undefined')
{
  new WebXRLayersPolyfill()
}
AFRAME.registerSystem('vartiste-init', {
  init() {
    document.addEventListener('keydown', e => {
      if (e.key == "r") document.querySelector('a-scene').systems['artist-root'].resetCameraLocation()
    })

    document.getElementById('got-it').addEventListener('click', e => {
      document.getElementById('need-help-notification').classList.add('hidden')
    })
  }
})
