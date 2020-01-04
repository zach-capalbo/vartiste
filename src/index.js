require('aframe-environment-component')

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
