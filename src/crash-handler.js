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
      this.installCrashCheck()
    })

    this.handleCrash = this._handleCrash
  },
  tick(t, dt) {
    this.numberOfBygoneTicks = 0
    this.installCrashCheck()
    if (this.hasCrashed) this.clearCrash()
    if (this.shouldCrash) throw new Error("Simulated VARTISTE crash")
  },
  installCrashCheck() {
    if (!this.interval) {
      this.interval = window.setInterval(() => {
        if (this.numberOfBygoneTicks++ > 5) this.handleCrash()
      }, 500)
    }
  },
  _handleCrash() {
    console.error("Handling crash. What to do what to do 😱");
    this.noticeDiv.classList.remove("hidden")
    this.hasCrashed = true

    this.handleCrash = function() {};
  },
  clearCrash() {
    console.info("Clearing crash")
    this.handleCrash = this._handleCrash()
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
    this.el.sceneEl.systems['settings-system'].export3dAction()
  },
  saveLayers() {
    this.el.sceneEl.querySelector('*[toolbox-shelf]').components['toolbox-shelf'].downloadAllLayersAction()
  },
  dismiss() {
    this.noticeDiv.classList.add('hidden')
  }
})
