import {Util} from './util.js'

const TRANSLATION = {
}

Util.registerComponentSystem('ui-translation', {
  schema: {
    language: {default: 'en'},
    baseLanguage: {default: 'en'},
  },
  init() {
    this.translationTable = TRANSLATION
    this.pendingTranslations = {}

    let params = new URLSearchParams(document.location.search)
    let lang = params.get("language")
    if (lang) {
      this.el.setAttribute('ui-translation', `language: ${lang}`)
    }
    else if (navigator.language)
    {
      try {
        this.el.setAttribute('ui-translation', `language: ${navigator.language.split("-")[0]}`)
      } catch (e) {
        console.warn("Could not set lanugage to", navigator.language, e)
      }
    }
  },
  async update(oldData) {
    if (this.data.language !== oldData.language)
    {
      await this.loadLanguage(this.data.language);
      this.updateTranslations()
    }

  },
  translate(str, ctx) {
    if (!this.data) return str;
    if (!this.translationTable[this.data.language]) return str;

    return this.translationTable[this.data.language][str] || str
  },
  updateTranslations() {
    document.querySelectorAll('a-entity[tooltip]').forEach(el => {
      el.components['tooltip'].update()
    })

    document.querySelectorAll('a-entity[shelf]').forEach(el => {
      let name = el.getAttribute('shelf').name
      if (!name) return;
      el.setAttribute('frame', 'name', this.translate(name, el))
    })

    document.querySelectorAll('a-entity[translate-text]').forEach(el => {
      el.setAttribute('text', 'value', this.translate(el.components['translate-text'].originalText, el))
    })
  },
  loadLanguage(lang) {
    if (lang === this.data.baseLanguage) return;
    if (lang in this.translationTable) return Promise.resolve();
    if (lang in this.pendingTranslations) return this.pendingTranslations[lang];

    this.pendingTranslations[lang] = (async () => {
      try {
        this.translationTable[lang] = await import(`./translations/${lang}.json`)
      } catch (e) {
        console.warn("Could not load language", lang)
        delete this.translationTable[lang]
        delete this.pendingTranslations[lang]
      }
    })();

    return this.pendingTranslations[lang];
  }
})

AFRAME.registerComponent('translate-text', {
  init() {
    this.originalText = this.el.getAttribute('text').value
    let system = this.el.sceneEl.systems['ui-translation']
    Util.whenLoaded(this.el, () => this.el.setAttribute('text', 'value', system.translate(this.originalText, this.el)))
  }
})
