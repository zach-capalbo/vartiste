require('./canvas-updater')
require('./draw-canvas')
require('./right-hand-controls')
require('./hand-draw-tool')
require('./compositor')

document.write(require('./scene.html.slm'))

document.getElementById('right-hand').setAttribute('right-hand-controls', "")
