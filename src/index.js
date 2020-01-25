//require('./framework/aframe.js')
require('aframe-environment-component')

require('./framework/GLTFExporter.js')
require('./framework/valve-index-controls.js')

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
require('./environments.js')

require('./app.styl')

document.write(require('./scene.html.slm'))

for (let fileName of require.context('./assets/', true, /.*/).keys()) {
  let asset = fileName.slice("./".length)
  var element = document.createElement('a-asset-item')
  element.setAttribute("src", require(`./assets/${asset}`))
  element.id = `asset-${asset.split(".")[0]}`
  document.getElementById('assets').append(element)
}


document.getElementById('right-hand').setAttribute('right-hand-controls', "")
document.getElementById('left-hand').setAttribute('left-hand-controls', "")

document.addEventListener('keydown', e => {
  if (e.key == "r") document.querySelector('a-scene').systems['settings-system'].resetCameraAction()
})
