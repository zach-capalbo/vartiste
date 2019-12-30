require('aframe-environment-component')

require('./icon-button')
require('./canvas-updater')
require('./draw-canvas')
require('./right-hand-controls')
require('./hand-draw-tool')
require('./color-picker')
require('./paint-system')
require('./compositor')
require('./manipulator')
require('./shelf')
require('./layer-preview')
require('./layer-shelves')
require('./settings-shelf')

document.write(require('./scene.html.slm'))

for (let asset of ['eye.png', 'brush.png', 'floppy.png', 'plus-box-multiple.png', 'shelf.png']) {
  var element = document.createElement('a-asset-item')
  element.setAttribute("src", require(`./assets/${asset}`).default)
  element.id = `asset-${asset.split(".")[0]}`
  document.getElementById('assets').append(element)
}

document.getElementById('right-hand').setAttribute('right-hand-controls', "")
