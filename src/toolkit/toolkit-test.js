require('!!file-loader?name=asset/studio.hdr!../assets/colorful_studio_1k.hdr')

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
  }
})
