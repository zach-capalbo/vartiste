import {BrushList} from './brush-list.js'

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
  toggleWrapXAction() {
    this.system.data.wrapX = !this.system.data.wrapX
  },
  toggleWrapYAction() {
    this.system.data.wrapY = !this.system.data.wrapY
  },
  toggleLatheAction() {
    document.querySelectorAll('*[lathe]').forEach(e=>e.setAttribute('lathe', {enabled: !e.getAttribute('lathe').enabled}))
  }
})
