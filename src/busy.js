const busyHtml = require('./partials/busy-indicator.html.slm')
class Busy {
  constructor(system, opts) {
    if (!opts.title) {
      throw new Error("Must specify busy title")
    }
    Object.assign(this, opts)
    this.system = system
    this.startTime = this.system.el.sceneEl.time
    this.finished = false
    this.doneCallbacks = null
  }
  done() {
    if (this.finished) {
      console.warn("Already finsihed job", this.title)
      return;
    }
    this.finished = true;
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
    console.error(e)
    this.system.displayError(`Error during ${this.title}:\n${e}`)
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
  },
  displayError(e) {
    for (let indicator of this.indicators) {
      indicator.showError(e.toString())
    }
  }
})

AFRAME.registerComponent('busy-indicator', {
  init() {
    this.el.innerHTML = busyHtml
    this.system.register(this)
  },
  remove() {
    this.system.unregister(this)
  },
  showError(txt) {
    let text = document.createElement('a-entity')
    this.el.sceneEl.append(text)
    text.setAttribute('text', `wrapCount: 20; color: red;`)
    text.setAttribute('text', 'value', txt)
    text.setAttribute('frame', 'closable: true')
    VARTISTE.Util.whenLoaded(text, () => {
      VARTISTE.Util.positionObject3DAtTarget(text.object3D, this.el.object3D)
    })
  }
})
