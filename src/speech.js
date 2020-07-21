import {Util} from './util.js'
Util.registerComponentSystem('speech', {
  schema: {
    speak: {default: false},
  },
  init() {
    this.utteranceCache = {}

    if (localStorage.speak === "true") {
      this.el.setAttribute('speech', {speak: true})
    }
  },
  update() {
    localStorage.speak = this.data.speak
  },
  speak(text) {
    if (!this.data.speak) return
    window.speechSynthesis.cancel()
    let utterance = text

    if (!(utterance instanceof SpeechSynthesisUtterance))
    {
      if (!(text in this.utteranceCache))
      {
        this.utteranceCache[text] = new SpeechSynthesisUtterance(text)
      }
      utterance = this.utteranceCache[text]
    }

    utterance.onend = () => {
      if (this.currentUtterance == utterance)
      {
        delete this.currentUtterance
      }
    };

    this.currentUtterance = utterance

    window.speechSynthesis.speak(utterance)
  },
  cancel(text) {
    if (!this.data.speak) return

    if (!this.currentUtterance) return

    if (text instanceof SpeechSynthesisUtterance && text === this.currentUtterance)
    {
      window.speechSynthesis.cancel()
    }
    else if (this.currentUtterance.text == text)
    {
      window.speechSynthesis.cancel()
    }
  }
})
