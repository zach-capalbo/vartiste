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

    this.brushButtons = []
    for (let idx = 0; idx < BrushList.length; ++idx) {
      let brush = BrushList[idx]
      let button = document.createElement('a-entity')
      button.setAttribute('icon-button', brush.previewSrc)
      button.setAttribute('brush-idx', idx)

      this.brushButtons.push(button)
      this.el.querySelector('.brushes').append(button)
    }
  },
  toggleRotationAction() {
    this.system.setRotateBrush(!this.system.data.rotateBrush)
  }
})
