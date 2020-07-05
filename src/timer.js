import {Util} from './util.js'

Util.registerComponentSystem('timer-system', {
  schema: {
    switchReferences: {default: false},
    shuffleReferences: {default: false},
    freshLayer: {default: false},
  },
  update(oldData) {
    if (this.data.switchReferences !== oldData.switchReferences && !this.data.switchReferences)
    {
      document.querySelectorAll('.reference-image').forEach(el => el.setAttribute('visible', true))
    }
  },
  playTimer() {
    this.timerActive = !this.timerActive

    this.startTime = this.el.sceneEl.time
    this.setTimeout(this.startTime)
    console.log("Starting timer at", this.startTime, this.timerActive, this.timeoutTime)

    if (!this.timerActive) return

    if (this.data.switchReferences) {
      this.swapReference()
    }
  },
  setTimeout(startTime) {
    let seconds = parseInt(document.querySelector('.timer-seconds').getAttribute('text').value)
    let minutes = parseInt(document.querySelector('.timer-minutes').getAttribute('text').value)
    this.timeoutTime = startTime + seconds * 1000 + minutes * 60 * 1000
  },
  tick(t, dt) {
    if (!this.timerActive) return

    let elapsedTime = t - this.startTime
    let timeDisplay = `${("00" + Math.floor(elapsedTime / 1000 / 60)).slice(-2)}:${("00" + Math.floor(elapsedTime / 1000) % 60).slice(-2)}`
    document.querySelectorAll('.timer-display').forEach(el => el.setAttribute('text', {value: timeDisplay}))

    if (this.timeoutTime > this.startTime &&  t > this.timeoutTime)
    {
      this.timeoutElapsed(this.timeoutTime)
      this.setTimeout(this.timeoutTime)
    }
  },
  timeoutElapsed() {
    console.log("Timer timeout")
    this.el.emit('timeout')

    if (this.data.switchReferences) {
      this.swapReference()
    }

    if (this.data.freshLayer) {
      if (Compositor.component.data.useNodes)
      {
        Compositor.component.addFrameAfter()
      }
      else
      {
        Compositor.component.activeLayer.visible = false
        Compositor.el.emit('layerupdated', {layer: Compositor.component.activeLayer})
        let layerIdx = Compositor.component.layers.indexOf(Compositor.component.activeLayer)
        Compositor.component.addLayer(layerIdx)
      }
    }
  },
  swapReference() {
    let references = Array.from(document.querySelectorAll('.reference-image'))
    let current = references.find(r => r.getAttribute('visible'))
    let next = references[(references.indexOf(current) + 1) % references.length]

    if (this.data.shuffleReferences)
    {
      do {
        next = references[Math.floor(Math.random() * references.length)]
      } while (next == current && references.length > 1)
    }

    for (let r of references) {
      if (r == next) continue
      r.setAttribute('visible', false)
    }
    next.setAttribute('visible', true)

    Util.positionObject3DAtTarget(next.object3D, current.object3D)
  }
})
