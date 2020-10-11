import {Util} from './util.js'
import {GALLERY_ENTRIES} from './static/gallery.js'

AFRAME.registerSystem('quick-menu', {
  init() {
    this.lastSummoned = {}
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
    this.el.querySelector('#quick-menu-project-name-edit').addEventListener('popupclosed', () => {
      this.el.sceneEl.systems['settings-system'].setProjectName(this.el.querySelector('#quick-menu-project-name-edit').getAttribute('text').value)
      this.el.querySelector('#quick-menu-project-name-edit').setAttribute('visible', false)
      this.quickSave()
    })
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
      this.el.setAttribute('shelf', 'offset', '0 -1.0 0')
      this.el.querySelectorAll('.quick-menu-more').forEach(el => el.setAttribute('visible', true))
      this.expanded = true
    }
    this.el.sceneEl.emit('refreshobjects')
  },
  toggleNodes() {
    let compositor = Compositor.el
    compositor.setAttribute('compositor', {useNodes: !compositor.getAttribute('compositor').useNodes})
    document.querySelector('*[node-control-panel]').setAttribute('visible', true)
  },
  quickSave() {
    let settings = this.el.sceneEl.systems['settings-system']
    if (!settings.hasSetProjectName)
    {
      let editField = this.el.querySelector('#quick-menu-project-name-edit')
      editField.setAttribute('visible', true)
      editField.components['popup-button'].launchPopup()
      return
    }

    if (this.el.sceneEl.isMobile)
    {
      settings.storeToBrowserAction()
    }
    else
    {
      settings.saveAction()
    }
  }
})

AFRAME.registerComponent('summoner-position', {
  schema: {
    el: {type: 'selector'},
    key: {type: 'string'},
  }
})

AFRAME.registerComponent('shelf-summoner', {
  schema: {
    name: {type: 'string'},
    selector: {type: 'selector'},
  },
  events: {
    click: function(e) {
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

    let key = ""

    if (this.summonerPositionEl)
    {
      key = this.summonerPositionEl.getAttribute('summoner-position').key
    }

    let lastSummoned = this.system.lastSummoned[key]

    if (lastSummoned && !lastSummoned.is('grab-activated'))
    {
      lastSummoned.setAttribute('visible', false)
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
    this.system.lastSummoned[key] = this.shelfEl
    this.el.sceneEl.emit('refreshobjects')
  }
})

AFRAME.registerComponent('quick-gallery', {
  events: {
    click: function(e) {

      let loadName = e.target.getAttribute('quick-load')
      console.log("Quick Load Button", e.target, loadName)
      if (!loadName) return

      this.el.sceneEl.systems['file-upload'].handleURL(require(`./gallery/${loadName}.vartiste`))
    }
  },
  init() {
    for (let entry of GALLERY_ENTRIES.find(s => s.section === "Templates").entries)
    {
      if (!entry.quickLoad) continue
      let img = require(`advanced-image-loader!./gallery/${entry.name}.png?width=128`)
      console.log(img)
      let button = document.createElement('a-entity')
      button.setAttribute('icon-button', img.src)
      button.setAttribute('tooltip', `Quick Start ${entry.displayName}`)
      button.setAttribute('quick-load', entry.name)
      this.el.append(button)
    }
  }
})
