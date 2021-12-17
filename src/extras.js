import {Util} from './util.js'

Util.registerComponentSystem('vartiste-extras', {
  schema: {
    url: {default: 'https://zach-geek.gitlab.io/vartiste-extras/'},
    cacheBusterDuration: {default: 1000 * 60},

    // url: {default: 'http://localhost:8081/'},
    // cacheBusterDuration: {default: 1},
  },
  init() {
  },
  update(oldData) {
    if (this.data.url !== oldData.url)
    {
      this.fetchIndex()
    }
  },
  async fetchIndex() {
    let res = await fetch(this.data.url + "index.json" + "?v=" + Date.now());
    this.index = await res.json()
    this.el.emit('vartisteextras', this.index)
  },
})

AFRAME.registerComponent('vartiste-extras-popup', {
  schema: {
    category: {type: 'string'},
    forceReference: {default: false},
  },
  events: {
    'popuplaunched': function(e) {
      e.stopPropagation()

      this.populate(e.detail)
    },
  },
  init() {
    this.system = this.el.sceneEl.systems['vartiste-extras'];
    this.el.setAttribute('popup-button', 'popup: extras-popup; deferred: true; autoScale: true')
  },
  populate(popup) {
    console.log("Populating extras", this.system.index[this.data.category])
    let contents = popup.querySelector('a-entity[shelf-content]')
    popup.addEventListener('click', (e) => {
      if (!e.target.hasAttribute('data-vartiste-extra')) return;
      this.el.sceneEl.systems['file-upload'].handleURL(`${this.system.data.url}/${this.data.category}/${e.target.getAttribute('data-vartiste-extra')}`, {forceReference: this.data.forceReference})
    })
    for (let item of this.system.index[this.data.category])
    {
      let name = item.split(".", 1)[0]
      let row = document.createElement('a-entity')
      contents.append(row)
      row.setAttribute('icon-row', '')
      let button = document.createElement('a-entity')
      row.append(button)
      button.setAttribute('icon-button', '#asset-folder-open-outline')
      button.setAttribute('data-vartiste-extra', item)
      button.setAttribute('tooltip', `Load ${name}`)
      button.setAttribute('popup-action', 'close')

      let label = document.createElement('a-entity')
      row.append(label)
      label.setAttribute('text', `value: ${name}; anchor: left; width: 2.5; wrapCount: 20`)
      label.setAttribute('position', '0.4 0 0')
    }

    this.populate = function() {};
  }
})
