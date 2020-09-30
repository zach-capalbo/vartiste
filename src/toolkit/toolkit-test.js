AFRAME.registerSystem('toolkit-demo', {
  speak() {
    let text = document.getElementById('demo-input').getAttribute('text').value
    this.el.systems['speech'].speak(text)
  },
  help() {
    window.open("https://vartiste.xyz/docs.html")
  }
})

AFRAME.registerSystem('load-hdri-from-webpack', {
  init() {
    document.querySelector('#hdr').src = require('../assets/colorful_studio_1k.hdr')
  }
})
