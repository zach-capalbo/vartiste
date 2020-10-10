import {Util} from './util.js'

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

  }
})
