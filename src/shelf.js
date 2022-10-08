const shelfHtml = require('./partials/shelf.html.slm')
const {Util} = require('./util.js')

// A moveable container for other components, consisting of a handlebar and a
// wood-like background. You can create a mixin with the id `shelf-bg` or
// `shelf-handle` to modify the background or handlebar, respectively.
//
// For instance,
//
//```
// <a-entity shelf="name: Demo Shelf; closeable: true; pinnable: false">
//   <a-entity icon-row="" position="-1.5 1 0">
//     <a-entity icon-button="#asset-close"></a-entity>
//     <a-entity icon-button="#asset-camera"></a-entity>
//     <a-entity icon-button="" text="value: 3; color: #FFF; wrapCount: 3; align: center; width: 0.4"></a-entity>
//   </a-entity>
//   <a-entity text="value: This is a what a shelf looks like by default; width: 2.8; align: center; anchor: center"></a-entity>
// </a-entity>
//```
//
// Is displayed as:
//
// ![A sample picture of a shelf](./static/images/demoshelf.png)
AFRAME.registerComponent('shelf', {
  dependencies: ['grab-activate', 'bypass-hidden-updates'],
  schema: {
    width: {default: 4},
    height: {default: 3},

    // Background & grabber offset relative to contents
    offset: {type: 'vec3', default: {x: 0, y: 0, z: 0}},

    //  Enables the [frame](#frame) component for the shelf when true
    frame: {default: true},
    closeable: {default: false},
    hideOnly: {default: true},
    pinnable: {default: true},

    // alias for closeable because I can't spell
    closable: {default: undefined, parse: o => o},

    grabRoot: {default: true},

    // If this shelf is summoned by a popup button. (Will be set automatically
    // when used with the `popup-button` component)
    popup: {default: false},

    // Title bar
    name: {type: 'string'},

    // If the height / width will never change, freezing can offer some render performance improvment
    freeze: {default: true},
  },
  events: {
    componentchanged: function(e) {
      if (e.detail.name === 'visible')
      {
        this.el.sceneEl.emit('refreshobjects')
      }
    }
  },
  init() {
    if (!this.el.attached) throw new Error("Not attached!")
    var container = document.createElement("a-entity")
    container.innerHTML = shelfHtml
    container.querySelectorAll('.clickable').forEach((e) => e['redirect-grab'] = this.el)
    this.container = container
    this.el.prepend(container)

    this.el.setAttribute('bypass-hidden-updates', '')

    if (this.data.grabRoot)
    {
      this.el.classList.add('grab-root')
    }

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
  update(oldData) {
    // Ack....
    if (this.data.closable !== undefined)
    {
      console.warn("shelf.closable will clobber shelf.closeable")
      this.data.closeable = this.data.closable
    }

    if (oldData && oldData.width && oldData.height && (oldData.width !== this.data.width || oldData.height !== this.data.height || oldData.offset !== this.data.offset))
    {
      this.unfreeze()
    }

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
            hideOnly: this.data.hideOnly,
            geometryTarget: this.container.querySelector('.bg'),
            name: Util.translate(this.data.name)
          })
        })
      }
      else if ((!oldData || this.data.name !== oldData.name) && this.data.frame)
      {
        Util.whenLoaded(this.container.querySelector('.bg'), () => {
          this.el.setAttribute('frame', 'name', Util.translate(this.data.name))
        })
      }

      if (this.data.popup && this.data.frame)
      {
        // this.el.setAttribute('six-dof-tool', "reparentOnActivate: true; summonable: false")
        Util.whenLoaded(this.container.querySelector('.bg'), () => {
          this.el.setAttribute('frame', 'closePopup', true)
        })
      }

      let handle = this.container.querySelector('.handle')
      handle.setAttribute('position', `0 -${this.data.height / 2 + handle.getAttribute('geometry').radius} 0`)
      handle.setAttribute('geometry', 'height', this.data.width * 1)

      if (this.data.freeze)
      {
        Util.callLater(() => this.freeze())
      }
    }
    else
    {
      this.container.addEventListener('loaded', e => this.update())
    }
  },
  freeze() {
    if (this.frozen) return;
    if (!this.data.freeze) return;

    this.container.object3D.parent.remove(this.container.object3D)
    this.el.sceneEl.object3D.add(this.container.object3D)
    this.container.object3D.updateMatrixWorld() 
    let merged = Util.mergeBufferGeometries(this.container.object3D, {useGroups: true, createConstruct: false})
    merged.el = this.el
    this.el.sceneEl.object3D.add(merged)
    this.el.setObject3D('mesh', merged)
    Util.applyMatrix(this.container.object3D.matrix, merged)
    this.container.object3D.parent.remove(this.container.object3D)
    this.container.parentEl.removeChild(this.container)
    this.merged = merged

    this.frozen = true
  },
  unfreeze() {
    if (!this.frozen) return
    this.merged.parent.remove(this.merged)
    Util.recursiveDispose(this.merged)
    var container = document.createElement("a-entity")
    container.innerHTML = shelfHtml
    container.querySelectorAll('.clickable').forEach((e) => e['redirect-grab'] = this.el)
    this.container = container
    this.el.prepend(container)
    this.frozen = false
    this.update({})
  }
});

AFRAME.registerComponent('expandable-shelf', {
  dependencies: ['shelf'],
  schema: {
    extraWidth: {default: 0.0},
    extraHeight: {default: 1.0},
    expanded: {default: false},
    expansionSelector: {default: '.expanded'}
  },
  init() {
    this.expanded = false;
    this.el.querySelectorAll(this.data.expansionSelector).forEach(el => {
      el.setAttribute('visible', this.expanded)
    })
  },
  update() {
    if (this.data.expanded === this.expanded) return;
    let {height, width} = this.el.getAttribute('shelf')
    if (this.data.expanded) {
      this.el.setAttribute('shelf', 'height', height + this.data.extraHeight)
      this.el.setAttribute('shelf', 'offset', `0 -${this.data.extraHeight / 2} 0`)
      this.el.querySelectorAll(this.data.expansionSelector).forEach(el => el.setAttribute('visible', true))
    } else {
      this.el.setAttribute('shelf', 'height', height - this.data.extraHeight)
      this.el.setAttribute('shelf', 'offset', `0 0 0`)
      this.el.querySelectorAll(this.data.expansionSelector).forEach(el => el.setAttribute('visible', false))
    }

    this.expanded = this.data.expanded
    this.el.sceneEl.emit('refreshobjects')
  }
})

// Automatically aligns to the parent shelf so that the first [`icon-button`](#icon-button) in the
// first [`icon-row`](#icon-row) is automatically positioned at the top left of the shelf
AFRAME.registerComponent('shelf-content', {
  schema: {
    padding: {default: 0.4}
  },
  init() {
    let el = this.el.parentEl
    while (el)
    {
      if (el.hasAttribute('shelf'))
      {
        this.shelf = el;
        break
      }
      el = el.parentEl
    }

    if (!el) {
      console.warn("shelf-content must be placed in a shelf")
      return;
    }

    this.el.classList.add('grab-root')
    this.el['redirect-grab'] = this.shelf
  },
  update(oldData) {
    if (!this.shelf) return
    Util.whenLoaded(this.shelf, () => {
      let shelf = this.shelf.getAttribute('shelf')
      this.el.setAttribute('position', `${- shelf.width / 2 + this.data.padding} ${shelf.height / 2 - this.data.padding} 0`)
    })
  }
})

AFRAME.registerComponent('hide-shelf-on-click', {
  events: {
    click: function(e) {
      window.setTimeout(() => {
        let el = this.el.parentEl
        while (el)
        {
          if (el.hasAttribute('shelf'))
          {
            el.setAttribute('visible', 'false')
            return;
          }
          el = el.parentEl
        }
      }, 200)
    }
  }
})

AFRAME.registerSystem('remember-position', {
  restoreAll() {
    this.el.sceneEl.querySelectorAll('a-entity[remember-position]').forEach(el => {
      el.components['remember-position'].restore()
    })
  }
})
AFRAME.registerComponent('remember-position', {
  init() {
  },
  play() {
    Util.whenLoaded(this.el, () => {
      Util.callLater(() => this.remember())
    })
  },
  remember() {
    this.initialMatrix = new THREE.Matrix4().copy(this.el.object3D.matrix)
    this.wasVisible = this.el.object3D.visible
  },
  restore() {
    Util.applyMatrix(this.initialMatrix, this.el.object3D)
    this.el.object3D.visible = this.wasVisible
  }
})
