const shelfHtml = require('./partials/shelf.html.slm')
const {Util} = require('./util.js')

AFRAME.registerComponent('shelf', {
  schema: {
    width: {default: 4},
    height: {default: 3},
    offset: {type: 'vec3', default: '0 0 0'},
    frame: {default: true},
    name: {type: 'string'}
  },
  init() {
    var container = document.createElement("a-entity")
    container.innerHTML = shelfHtml
    container.querySelectorAll('.clickable').forEach((e) => e['redirect-grab'] = this.el)
    this.container = container
    this.el.prepend(container)


    let inBillboard = false
    for (let parent = this.el.parentEl; parent; parent = parent.parentEl)
    {
      if (parent.hasAttribute('billboard'))
      {
        inBillboard = true
        break
      }
    }

    if (!inBillboard)
    {
      // this.el.setAttribute('billboard', "")
    }
  },
  update() {
    if (this.container.hasLoaded)
    {
      this.container.querySelector('.bg').setAttribute('geometry', {width: this.data.width, height: this.data.height})
      this.container.setAttribute('position', this.data.offset)

      if (!this.el.hasAttribute('frame') && this.data.frame)
      {
        Util.whenLoaded(this.container.querySelector('.bg'), () => {
          this.el.setAttribute('frame', {
            outline: false,
            closable: false,
            geometryTarget: this.container.querySelector('.bg')
          })
        })
      }

      this.container.querySelector('.handle').setAttribute('position', `0 -${this.data.height / 2 + 0.1} 0`)
    }
    else
    {
      this.container.addEventListener('loaded', e => this.update())
    }
  }
});
