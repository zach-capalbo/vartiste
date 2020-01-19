const shelfHtml = require('./partials/shelf.html.slm')

AFRAME.registerComponent('shelf', {
  schema: {
    width: {default: 4},
    height: {default: 3}
  },
  init() {
    var container = document.createElement("a-entity")
    container.innerHTML = shelfHtml
    container.querySelectorAll('.clickable').forEach((e) => e['redirect-grab'] = this.el)
    this.container = container
    this.el.prepend(container)
  },
  update() {
    if (this.container.hasLoaded)
    {
      this.container.querySelector('.bg').setAttribute('geometry', {width: this.data.width, height: this.data.height})
    }
    else
    {
      this.container.addEventListener('loaded', e => this.update())
    }
  }
});
