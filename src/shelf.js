const shelfHtml = require('./partials/shelf.html.slm')

AFRAME.registerComponent('shelf', {
  init() {
    var container = document.createElement("a-entity")
    container.innerHTML = shelfHtml
    this.el.prepend(container)
  }
});
