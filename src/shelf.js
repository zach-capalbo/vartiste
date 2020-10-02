const shelfHtml = require('./partials/shelf.html.slm')
const {Util} = require('./util.js')

// A moveable container for other components, consisting of a handlebar and a
// wood-like background
AFRAME.registerComponent('shelf', {
  schema: {
    width: {default: 4},
    height: {default: 3},

    // Background & grabber offset relative to contents
    offset: {type: 'vec3', default: '0 0 0'},

    //  Enables the [frame](#frame) component for the shelf when true
    frame: {default: true},
    closeable: {default: false},
    pinnable: {default: true},

    // Possible future use for documentation or adding a titlebar
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
            closable: this.data.closeable,
            pinnable: this.data.pinnable,
            geometryTarget: this.container.querySelector('.bg'),
            name: this.data.name
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
