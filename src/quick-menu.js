import {Util} from './util.js'
import {GALLERY_ENTRIES} from './static/gallery.js'

AFRAME.registerSystem('quick-menu', {
  init() {
  }
})

AFRAME.registerComponent('quick-menu', {
  events: {
    click: function(e) {
      if (e.target.hasAttribute('quick-menu-action'))
      {
        this[e.target.getAttribute('quick-menu-action')](e)
      }
    }
  },
  init() {

  },
  expandQuickMenu() {
    if (this.expanded)
    {
      this.el.setAttribute('shelf', 'height', 1)
      this.el.setAttribute('shelf', 'offset', '0 0 0')
      this.expanded = false
      this.el.querySelectorAll('.quick-menu-more').forEach(el => el.setAttribute('visible', false))
    }
    else
    {
      this.el.setAttribute('shelf', 'height', 3)
      this.el.setAttribute('shelf', 'offset', '0 -0.75 0')
      this.el.querySelectorAll('.quick-menu-more').forEach(el => el.setAttribute('visible', true))
      this.expanded = true
    }
  },
  toggleNodes() {
    let compositor = Compositor.el
    compositor.setAttribute('compositor', {useNodes: !compositor.getAttribute('compositor').useNodes})
    document.querySelector('*[node-control-panel]').setAttribute('visible', true)
  }
})

AFRAME.registerComponent('summoner-position', {
  schema: {
    el: {type: 'selector'}
  }
})

AFRAME.registerComponent('shelf-summoner', {
  schema: {
    name: {type: 'string'},
    selector: {type: 'selector'}
  },
  events: {
    click: function() {
      this.summon()
    }
  },
  init() {
    this.system = this.el.sceneEl.systems['quick-menu']
    Util.whenLoaded(this.el.sceneEl, () => {

      Util.traverseAncestors(this.el, (el) => {
        if (this.summonerPositionEl) return
        if (el.hasAttribute('summoner-position'))
        {
          this.summonerPositionEl = el
        }
      })
      this.update()
    })
  },
  update() {
    if (this.data.selector)
    {
      this.shelfEl = this.data.selector
    }
    else if (this.data.name)
    {
      this.shelfEl = Array.from(document.querySelectorAll('*[shelf]')).find(el => el.getAttribute('shelf').name === this.data.name)
    }
    else
    {
      this.shelfEl = null
    }
  },
  summon() {
    if (!this.shelfEl) {
      console.log("Cannot summon unknown shelf", this.data.name, this.data.selector)
      return
    }

    if (this.system.lastSummoned && !this.system.lastSummoned.is('grab-activated'))
    {
      this.system.lastSummoned.setAttribute('visible', false)
    }

    if (this.summonerPositionEl)
    {
      let summonerPositionData = this.summonerPositionEl.getAttribute('summoner-position')
      let positionObj = summonerPositionData.el.object3D
      Util.positionObject3DAtTarget(this.shelfEl.object3D, positionObj)
      this.shelfEl.object3D.scale.copy(positionObj.scale)
    }
    else
    {
      Util.flyToCamera(this.shelfEl)
      this.shelfEl.object3D.scale.set(0.3, 0.3, 0.3)
    }
    this.shelfEl.setAttribute('visible', true)

    this.shelfEl.removeState('grab-activated')
    this.system.lastSummoned = this.shelfEl

  }
})

AFRAME.registerComponent('quick-gallery', {
  init() {
    const QUICK_ITEMS = ["paper", "graffiti", "hubs_avatar"]

    for (let name of QUICK_ITEMS)
    {
      let img = require(`advanced-image-loader!./gallery/${name}.png?width=256`)
      console.log(img)
      let button = document.createElement('a-entity')
      button.setAttribute('icon-button', img.src)
      button.setAttribute('tooltip', `Quick Start ${name}`)
      button.setAttribute('quick-load', name)
      this.el.append(button)
    }
  }
})
