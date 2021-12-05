import {BrushList} from './brush-list.js'
import {Undo} from './undo.js'
import {STATE_TOGGLED} from './icon-button.js'
import {Util} from './util.js'

const BRUSHES_PER_ROW = 8
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

    this.el.sceneEl.addEventListener('brushchanged', (e) => {
      let brush = e.detail.brush
      let idx = e.detail.index
      for (let button of this.el.querySelectorAll('*[brush-idx]'))
      {
        if (button.getAttribute('brush-idx') == idx)
        {
          button.addState(STATE_TOGGLED)
        }
        else
        {
          button.removeState(STATE_TOGGLED)
        }
      }
    })


    this.brushRow = document.createElement('a-entity')
    this.el.querySelector('.brushes').append(this.brushRow)

    Util.whenLoaded(this.el, async () => {
      this.brushButtons = []
      for (let idx = 0; idx < BrushList.length; ++idx) {

        await this.addBrush(BrushList[idx], true)
      }
    })
  },
  async addBrush(brush, defaultBrush = false) {
    if (brush.hidden) return;
    if (this.nextTimeExpand)
    {
      if (this.el.querySelector('.brushes').children.length > 4)
      {
        let extra = this.el.querySelector('.brushes').children.length - 4
        this.el.setAttribute('shelf', 'height', 3.5 + extra * 0.6)
        this.el.setAttribute('shelf', 'offset', `0 ${- extra * 0.6 / 2} 0`)
      }
      this.nextTimeExpand = false
    }
    let button = document.createElement('a-entity')
    let idx = BrushList.indexOf(brush)

    if (idx < 0)
    {
      BrushList.push(brush)
      idx = BrushList.length - 1
    }

    button.setAttribute('icon-button', brush.previewSrc)
    button.setAttribute('brush-idx', idx)
    button.setAttribute('tooltip', brush.tooltip)
    button.setAttribute('action-tooltips', 'trigger: Set Brush')

    this.brushButtons.push(button)
    this.brushRow.append(button)

    if (defaultBrush)
    {
      await Util.whenLoaded(button)
    }


    if ((BrushList.filter(b => !b.hidden).indexOf(brush) % BRUSHES_PER_ROW) == BRUSHES_PER_ROW - 1)
    {
      if (defaultBrush)
      {
        await Util.delay(10)
        this.brushRow.setAttribute('icon-row', 'autoPosition: false; mergeButtons: true')
      }
      this.brushRow = document.createElement('a-entity')
      this.brushRow.setAttribute('position', `0 ${-0.6 * this.el.querySelector('.brushes').children.length} 0`)
      this.el.querySelector('.brushes').append(this.brushRow)
      this.nextTimeExpand = true
    }
  },
  deleteLastBrush() {
    let lastButton = Array.from(this.el.querySelectorAll('*[brush-idx]')).slice(-1)[0]
    lastButton.remove()
    BrushList.pop()
  },
  hideBrushAt(idx) {
    this.el.querySelector(`*[brush-idx="${idx}"]`).setAttribute('visible', false)
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
    this.el.sceneEl.systems['cut-copy-system'].clear()
  }
})
