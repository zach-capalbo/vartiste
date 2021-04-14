const busyHtml = require('./partials/busy-indicator.html.slm')
class Busy {
  constructor(system, opts) {
    if (!opts.title) {
      throw new Error("Must specify busy title")
    }
    Object.assign(this, opts)
    this.system = system
    this.startTime = this.system.el.sceneEl.time
  }
  done() {
    this.endTime = this.system.el.sceneEl.time
    this.duration = this.endTime - this.startTime
    if (this.doneCallbacks) {
      for (let c of this.doneCallbacks) {
        c()
      }
    }
    this.system.ended(this)
    console.info(`${this.title} took ${this.duration} ms`)
  }
  error(e) {
    this.done()
  }
  await() {
    if (!this.doneCallbacks) {
      this.doneCallbacks = []
    }
    return new Promise((r, e) => {
      this.doneCallbacks.push(r)
    })
  }
}

AFRAME.registerSystem('busy-indicator', {
  init() {
    this.indicators = []
    this.busyObjects = new Set()
  },
  busy(opts) {
    let busy = new Busy(this, opts)
    this.busyObjects.add(busy)
    this.setupIndicators()
    return busy
  },
  ended(busy) {
    this.busyObjects.delete(busy)
    this.setupIndicators()
  },
  setupIndicators() {
    if (this.busyObjects.size === 0)
    {
      for (let indicator of this.indicators) {
        indicator.el.setAttribute('visible', false)
        indicator.el.pause()
      }

      return;
    }

    let tooltip = "Busy...\n" + Array.from(this.busyObjects).map(f => "- " + f.title).join("\n")
    for (let indicator of this.indicators) {
      indicator.el.setAttribute('visible', true)
      indicator.el.setAttribute('tooltip', tooltip)
      indicator.el.play()
    }
  },
  register(c) {
    this.indicators.push(c)
    this.setupIndicators()
  },
  unregister(c) {
    this.indicators.splice(this.indicators.indexOf(this))
  }
})

AFRAME.registerComponent('busy-indicator', {
  init() {
    this.el.innerHTML = busyHtml
    this.system.register(this)
  },
  remove() {
    this.system.unregister(this)
  }
})
