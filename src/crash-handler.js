import {Util} from './util.js'

AFRAME.registerSystem('crash-handler', {
  init() {
    this.shouldCrash = false
    this.numberOfBygoneTicks = 0
    this.interval = undefined

    let noticeDiv = document.createElement('div')
    this.noticeDiv = noticeDiv
    noticeDiv.innerHTML = require('./partials/crash-handler.html.slm')
    noticeDiv.classList.add('hidden')
    noticeDiv.classList.add('crash-bg')
    document.body.append(noticeDiv)

    noticeDiv.querySelectorAll('*[click-action]').forEach(el => {
      el.addEventListener('click', (e) => {
        this.tryRecoveryOption(el.getAttribute('click-action'));
      })
    })

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden')
      {
        window.clearInterval(this.interval)
        this.interval = undefined
        this.numberOfBygoneTicks = 0
        return
      }
      else if (document.visibilityState === 'visible')
      {
        this.installCrashCheck()
      }
    })

    this.handleCrash = this._handleCrash
    this.crashCount = 0

    this.oldRender = this.el.sceneEl.render;
    this.renderFn = ((...args) => {
        try {
          this.oldRender.call(this.el.sceneEl, ...args);
          this.crashCount = 0
        } catch (e) {
          this._handleCrash(e)
          if (this.crashCount++ > 5)
          {
            throw e;
          }
        }
    }).bind(this)
    Object.defineProperty(this.el.sceneEl, 'render', {
      get: () => this.renderFn,
      set: (r) => this.oldRender = r,
    })
  },
  tick(t, dt) {
    this.numberOfBygoneTicks = 0
    if (dt < 50 && !this.interval && document.visibilityState === "visible") this.installCrashCheck()
    // if (this.crashShown) this.clearCrash()
    if (this.shouldCrash) throw new Error("Simulated VARTISTE crash")
  },
  installCrashCheck() {
    // Disabling since it doesn't work / is no longer needed?
    return;
    console.log("Installing check")
    if (!this.interval) {
      this.interval = window.setInterval(() => {
        if (this.numberOfBygoneTicks++ > 5) this.handleCrash()
      }, 500)
    }
  },
  _handleCrash(e) {
    console.error(e)
    if (this.crashShown) return
    console.error("Handling crash. What to do what to do 😱");
    this.noticeDiv.querySelector('#crash-stack-trace').innerText = ">> " + e.toString() + "\n\n" + e.stack
    this.noticeDiv.classList.remove("hidden")
    this.hasCrashed = true
    this.crashShown = true
    this.handleCrash = function() {};
  },
  clearCrash() {
    this.handleCrash = this._handleCrash
    this.numberOfBygoneTicks = 0
    this.crashShown = false
  },
  tryRecoveryOption(option)
  {
    let messageDiv = this.noticeDiv.querySelector('#recovery-attempt-message')
    messageDiv.innerText = "Attempting Recovery..."

    try {
      this[option]()
    } catch (e) {
      messageDiv.innerText = "Unfortately, that did not work ☹"
      console.error(e)
      return
    }

    messageDiv.innerText = ""
  },
  saveProject() {
    this.el.sceneEl.systems['settings-system'].saveAction()
  },
  saveGLB() {
    this.el.sceneEl.systems['export-3d-helper-system'].export3dAction()
  },
  saveLayers() {
    this.el.sceneEl.querySelector('*[toolbox-shelf]').components['toolbox-shelf'].downloadAllLayersAction()
  },
  dismiss() {
    this.noticeDiv.classList.add('hidden')
  }
})


AFRAME.registerSystem('enter-vr-failed-handler', {
  init() {
    let noticeDiv = document.createElement('div')
    this.noticeDiv = noticeDiv
    noticeDiv.innerHTML = require('./partials/enter-vr-failed-handler.html.slm')
    noticeDiv.classList.add('hidden')
    noticeDiv.classList.add('crash-bg')
    document.body.append(noticeDiv)

    noticeDiv.querySelector('#dismiss-and-ignore-enter-vr').addEventListener('click', () => {
      this.ignored = true
      noticeDiv.classList.add('hidden')
    })

    document.addEventListener('fullscreenchange', () => {
      if (this.shouldExitFullscreen && !this.ignored)
      {
        document.exitFullscreen()
      }
    });

    this.el.addEventListener('enter-vr', () => {
      if (this.ignored) return
      if (navigator.xr && !this.el.xrSession) {
        console.warn("No XR Session")
        noticeDiv.classList.remove('hidden')
        this.shouldExitFullscreen = true
      }
    })
  }
})
