require('./canvas-updater')
require('./draw-canvas')
require('./right-hand-controls')
require('./hand-draw-tool')
require('./color-picker')
require('./paint-system')
require('./compositor')

document.write(require('./scene.html.slm'))

document.getElementById('right-hand').setAttribute('right-hand-controls', "")
