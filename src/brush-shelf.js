import {BrushList} from './brush-list.js'
import {Undo} from './undo.js'
import {STATE_TOGGLED} from './icon-button.js'
import {Util} from './util.js'

const BRUSHES_PER_ROW = 8
AFRAME.registerComponent('brush-shelf', {
  schema: {
    rowCount: {default: 2},
    currentRowStart: {default: 0},
    rowSpacing: {default: 0.6}
  },
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
    this.brushRow.setAttribute('bypass-hidden-updates', '')

    Util.whenLoaded(this.el, async () => {
      this.brushButtons = []
      for (let idx = 0; idx < BrushList.length; ++idx) {

        await this.addBrush(BrushList[idx], true)
      }
    })
  },
  update(oldData) {
    if (this.data.rowCount !== oldData.rowCount && oldData.rowCount)
    {
      this.layoutHeight()
    }

    this.layoutRows()
  },
  async addBrush(brush, defaultBrush = false) {
    if (brush.hidden) return;

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
      this.brushRow.setAttribute('position', `0 ${-this.data.rowSpacing * this.el.querySelector('.brushes').children.length} 0`)

      this.el.querySelector('.brushes').append(this.brushRow)
      this.brushRow.setAttribute('bypass-hidden-updates', '')
      this.nextTimeExpand = true
    }

    if (!defaultBrush)
    {
      this.data.currentRowStart = this.clampRowStart(99999)
      this.layoutHeight()
    }
    this.layoutRows()
  },
  layoutRows() {
    let rows = Array.from(this.el.querySelectorAll('.brushes > a-entity'))
    const {currentRowStart, rowCount} = this.data;

    for (let i = 0; i < rows.length; ++i)
    {
      let row = rows[i]
      if (i >= currentRowStart && i < currentRowStart + rowCount)
      {
        row.setAttribute('visible', true)
        row.setAttribute('position', `0 ${-this.data.rowSpacing * (i - currentRowStart)} 0`)
      }
      else
      {
        row.setAttribute('visible', false)
      }
    }
  },
  layoutHeight() {
    let rows = Array.from(this.el.querySelectorAll('.brushes > a-entity'))
    const {rowCount} = this.data;
    let extra = Math.min(rowCount, rows.length) - 2
    this.el.setAttribute('shelf', 'height', 2.9 + extra * 0.6)
    this.el.setAttribute('shelf', 'offset', `0 ${- extra * 0.6 / 2} 0`)

    this.el.querySelector('.brush-page-controls').object3D.position.y = - 0.96 - extra * 0.6
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
  },
  clampRowStart(row) {
    let currentRows = Array.from(this.el.querySelectorAll('.brushes > a-entity')).length
    return THREE.MathUtils.clamp(row, 0, Math.max(0, currentRows - this.data.rowCount))
  },
  nextRowAction() {
    this.el.setAttribute('brush-shelf', 'currentRowStart', this.clampRowStart(this.data.currentRowStart + 1))
  },
  previousRowAction() {
    this.el.setAttribute('brush-shelf', 'currentRowStart', this.clampRowStart(this.data.currentRowStart - 1))
  },
  showAllAction() {
    this.el.setAttribute('brush-shelf', 'rowCount', this.data.rowCount > 2 ? 2 : 9999)
    this.el.setAttribute('brush-shelf', 'currentRowStart', 0)
  }
})
