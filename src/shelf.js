const shelfHtml = require('./partials/shelf.html.slm')

AFRAME.registerComponent('shelf', {
  init() {
    var container = document.createElement("a-entity")
    container.innerHTML = shelfHtml
    container.querySelectorAll('.clickable').forEach((e) => e['redirect-grab'] = this.el)
    this.el.prepend(container)
  }
});
