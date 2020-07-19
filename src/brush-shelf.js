import {BrushList} from './brush-list.js'
import {Undo} from './undo.js'

AFRAME.registerComponent('brush-shelf', {
  init() {
    this.system = this.el.sceneEl.systems['paint-system']

    this.el.innerHTML = require('./partials/brush-shelf.html.slm')

    this.el.addEventListener('click', (e) => {
      if (e.target.hasAttribute('click-action'))
      {
        console.log("Clicked", e.target.getAttribute("click-action"))
        this[e.target.getAttribute("click-action") + 'Action'](e)
      }
      else if (e.target.hasAttribute('brush-idx'))
      {
        let idx = e.target.getAttribute('brush-idx')
        this.system.selectBrush(idx)
      }
    })

    const BRUSHES_PER_ROW = 8

    let brushRow = document.createElement('a-entity')
    this.el.querySelector('.brushes').append(brushRow)

    this.brushButtons = []
    for (let idx = 0; idx < BrushList.length; ++idx) {
      let brush = BrushList[idx]
      let button = document.createElement('a-entity')
      button.setAttribute('icon-button', brush.previewSrc)
      button.setAttribute('brush-idx', idx)
      button.setAttribute('tooltip', brush.tooltip)

      this.brushButtons.push(button)
      brushRow.append(button)

      if ((idx % BRUSHES_PER_ROW) == BRUSHES_PER_ROW - 1)
      {
        brushRow = document.createElement('a-entity')
        brushRow.setAttribute('position', `0 ${-0.6 * this.el.querySelector('.brushes').children.length} 0`)
        this.el.querySelector('.brushes').append(brushRow)
      }
    }
  },
  toggleRotationAction() {
    this.system.setRotateBrush(!this.system.data.rotateBrush)
  },
  toggleOrientationAction() {
    document.querySelectorAll('*[hand-draw-tool]').forEach(e=>e.setAttribute('tracked-controls', {orientationOffset: {x: 43 + 90, y: 180, z: 90}}))
  },
  increaseBrushSizeAction() {
    this.system.scaleBrush(100)
  },
  decreaseBrushSizeAction() {
    this.system.scaleBrush(-100)
  },
  clearLayerAction() {
    Undo.pushCanvas(Compositor.component.activeLayer.canvas)
    Compositor.component.activeLayer.canvas.getContext('2d').clearRect(0, 0, Compositor.component.activeLayer.canvas.width, Compositor.component.activeLayer.canvas.height)
    Compositor.component.activeLayer.touch()
  }
})
