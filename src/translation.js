import {Util} from './util.js'

const TRANSLATION = {
  pt: require('./translations/pt.json')
}

Util.registerComponentSystem('ui-translation', {
  schema: {
    language: {default: 'pt'},
  },
  init() {
    this.translationTable = TRANSLATION

    this.updateTranslations()
  },
  update(oldDate) {
    this.updateTranslations()
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
  }
})
