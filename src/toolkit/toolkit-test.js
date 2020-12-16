require('!!file-loader?name=asset/studio.hdr!../assets/colorful_studio_1k.hdr')

AFRAME.registerSystem('toolkit-demo', {
  init() {
    let ctx = document.getElementById('draw-canvas-asset').getContext('2d')
    ctx.fillStyle = "#FFF"
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height)
  },
  speak() {
    let text = document.getElementById('demo-input').getAttribute('text').value
    this.el.systems['speech'].speak(text)
  },
  help() {
    window.open("https://vartiste.xyz/docs.html")
  }
})
