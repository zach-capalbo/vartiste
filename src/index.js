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

document.write(require('./scene.html.slm'))

for (let asset of ['eye.png', 'brush.png', 'floppy.png', 'plus-box-multiple.png', 'shelf.png', 'delete.png', 'arrow-up-bold.png', 'arrow-down-bold.png', 'blur-linear.png', 'check-outline.png']) {
  var element = document.createElement('a-asset-item')
  element.setAttribute("src", require(`./assets/${asset}`).default)
  element.id = `asset-${asset.split(".")[0]}`
  document.getElementById('assets').append(element)
}

document.getElementById('right-hand').setAttribute('right-hand-controls', "")
document.getElementById('left-hand').setAttribute('left-hand-controls', "")
