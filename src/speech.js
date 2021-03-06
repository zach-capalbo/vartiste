import {Util} from './util.js'
import {Sfx} from './sfx.js'
const Color = require('color')

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
const SpeechGrammarList = window.SpeechGrammarList || window.webkitSpeechGrammarList

// System for text-to-speech and speech recognition
//
// #### Text To Speech
//
// Components can call `this.el.sceneEl.components.speech.speak(text)` to have
// `text` read aloud
//
// **NOTE:** This will only work for browsers that support the
// [SpeechSynthesis](https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesis)
// API.
//
// #### Speech Recognition
//
// Components can call `listen()` to start speech recongition. However, it is
// preferable to use a `speech-recognition-button` component, as it provides a
// visual indication of when speech recongition is occuring.
//
// When text is recognized, the system will attempt to find an element with a
// matching [`tooltip` component](#tooltip) or `speech-alias` attribute. If a
// matching element is found, it will be sent the `click` event, with the detail
// `{type: 'speech'}`
//
// If there is an active keyboard for an [`edit-field`](#edit-field), then the
// keyboard's value will be set to the speech recognition result, instead.
//
// **NOTE:** This only works on browsers that support the
// [SpeechRecognition](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition)
// API.
Util.registerComponentSystem('speech', {
  schema: {
    // If true, then text-to-speech is enabled. Note that this property is
    // "sticky"; it gets saved to the browser `localStorage` and restored when
    // the user next visits the page.
    speak: {default: false},

    // If true, then
    autoRestart: {default: false}
  },
  init() {
    this.utteranceCache = {}


    let params = new URLSearchParams(document.location.search)
    if (params.get("speak") === "true")
    {
      this.el.setAttribute('speech', {speak: true})
    }
    else if (params.get("speak") === "false")
    {
      this.el.setAttribute('speech', {speak: false})
    }
    else if (localStorage.speak === "true") {
      this.el.setAttribute('speech', {speak: true})
    }


    if (SpeechRecognition)
    {
      this.recognition = new SpeechRecognition();

      this.recognition.onresult = (e) => {
        console.log("Speech Result", e.results);
        this.handleRecognitionTranscript(e.results[0][0].transcript, e.results)
      }

      this.recognition.onstart = (e) => {
        this.isListening = true
      }
      //
      // this.recognition.onspeechend = (e) => {
      //   this.recognition.stop();
      //   console.log('Speech recognition has stopped.', e, this.recognition);
      // }

      this.recognition.onerror = (e) => {
        console.log("recognition error", e)
        this.el.emit('recognitionerror', {})
      }

      this.recognition.onend = (e) => {
        this.isListening = false

        if (this.data.autoRestart)
        {
          window.setTimeout(() => this.recognition.start(), 200)
        }
      }

      this.el.addEventListener('recognitionerror', () => Sfx.recognitionerror(this.el))
    }
  },
  update() {
    localStorage.speak = this.data.speak
  },

  // Speaks the given `text` string if speech is enabled. Cancels any in-progress speech
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

  // Cancels speeking if `text` is currently being spoken
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
  },

  buildGrammar() {
    let tooltipEls = Array.from(document.querySelectorAll('*[tooltip]'))

    let tooltips = []
    tooltips.length = tooltipEls.length

    for (let i = 0; i < tooltips.length; ++i)
    {
      let tooltipText = tooltipEls[i].getAttribute('tooltip').replace(/[^\w]/g, "")
      tooltips[i] = `${tooltipText[i]} {TT${i}}`
    }

    var grammar = `
    #JSGF V1.0;
    grammar vartiste;
    <color> = aqua | azure | beige | bisque | black | blue | brown | chocolate | coral | crimson | cyan | fuchsia | ghostwhite | gold | goldenrod | gray | green | indigo | ivory | khaki | lavender | lime | linen | magenta | maroon | moccasin | navy | olive | orange | orchid | peru | pink | plum | purple | red | salmon | sienna | silver | snow | tan | teal | thistle | tomato | turquoise | violet | white | yellow ;
    public <command> = ${tooltips.join(" | ")};
    `;

    var speechRecognitionList = new SpeechGrammarList();
    speechRecognitionList.addFromString(grammar, 1);
    this.recognition.grammars = speechRecognitionList;
  },

  // Listens for a voice command
  listen() {
    this.buildGrammar()
    this.recognition.start()
  },
  handleRecognitionTranscript(text)
  {
    Sfx.recognition(this.el)

    let inputField = document.querySelector('input:focus')

    if (inputField)
    {
      if (text === "okay" && inputField.editField)
      {
        inputField.editField.ok()
        return
      }
      else if (text === "clear") {
        inputField.editField.clear()
        return
      }

      inputField.value = text
      inputField.dispatchEvent(new Event('input'))
      return
    }

    let target = Array.from(document.querySelectorAll('*[tooltip]')).find(el => el.getAttribute('tooltip').toLowerCase() === text.toLowerCase())

    if (!target) {
      target = Array.from(document.querySelectorAll('*[speech-alias]')).find(el => el.getAttribute('speech-alias').split(";").some(s => s.trim().toLowerCase() === text.toLowerCase()))
    }

    if (target)
    {
      target.emit('click', {type: "speech"}, true)
      return
    }

    try {
      let color = Color(text.toLowerCase()).rgb().hex()
      this.el.systems['paint-system'].selectColor(color)
      return
    }
    catch (e) {}

    console.warn("Text unrecognized:", text)

    this.el.emit('recognitionerror', {text: text})
  }
})

// Adds an [icon-button](#icon-button) which can be clicked to trigger speech
// recognition. The button will turn green while listening, and red if there is
// a recognition error. The button will be hidden if speech recognition is not
// available in the user's browser.
AFRAME.registerComponent('speech-recognition-button', {
  dependencies: ['icon-button', 'button-style'],
  events: {
    click: function() {
      if (!this.el.sceneEl.systems['speech'].isListening)
      {
        this.el.sceneEl.systems['speech'].listen()
      }
      else
      {
        this.el.sceneEl.systems['speech'].stopListening()
      }
    }
  },
  init() {
    Util.whenLoaded(this.el.sceneEl, () => {
      let recognition = this.el.sceneEl.systems['speech'].recognition
      if (!recognition) {
        this.el.setAttribute('visible', 'false')
        return
      }

      this.originalColor = this.el.components['button-style'].data.color
      recognition.addEventListener('start', () => {
        if (!this.inError)
        {
          this.originalColor = this.el.components['button-style'].data.color
        }

        this.inError = false
        this.el.setAttribute('button-style', {color: this.el.components['button-style'].data.toggleOnColor})
      })

      recognition.addEventListener('end', () => {
        if (!this.inError)
        {
          this.el.setAttribute('button-style', {color: this.originalColor})
        }
      })

      this.el.sceneEl.addEventListener('recognitionerror', () => {
        this.inError = true
        this.el.setAttribute('button-style', {color: "#f50f41"})
        window.setTimeout(() => this.el.setAttribute('button-style', {color: this.originalColor}), 1000)
      })
    })
  }
})
