AFRAME.registerSystem('toolkit-demo', {
  speak() {
    let text = document.getElementById('demo-input').getAttribute('text').value
    this.el.systems['speech'].speak(text)
  }
})
