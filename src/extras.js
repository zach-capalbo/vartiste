import {Util} from './util.js'

Util.registerComponentSystem('vartiste-extras', {
  schema: {
    url: {default: 'https://zach-geek.gitlab.io/vartiste-extras/'},
    cacheBusterDuration: {default: 1000 * 60},

    extraURLs: {default: [], type: 'array'},

    // url: {default: 'http://localhost:8081/'},
    // cacheBusterDuration: {default: 1},
  },
  init() {
  },
  update(oldData) {
    if (this.data.url !== oldData.url || this.data.extraURLs !== oldData.extraURLs)
    {
      this.updateExtraURLs()
    }
  },
  async fetchIndex() {
    let res = await fetch(this.data.url + "index.json" + "?v=" + Date.now());
    this.index = await res.json()
  },
  async updateExtraURLs() {
    this.indices = new Map()
    await this.fetchIndex()
    this.indices.set(this.data.url, this.index)
    for (let i in this.data.extraURLs)
    {
      let extra = this.data.extraURLs[i]
      if (extra.endsWith("/")) {
        extra = extra.slice(0, -1)
        this.data.extraURLs[i] = extra
      }
      let res = await fetch(extra + "/index.json" + "?v=" + Date.now());
      let index = await res.json()
      this.indices.set(extra, index)
    }
    this.el.emit('vartisteextras', this.indices)
  }
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
    console.log("Populating extras", this.system.index[this.data.category], popup)
    let contents = popup.querySelector('a-entity[shelf-content]')
    let shelf = popup.querySelector('a-entity[shelf]')
    popup.addEventListener('click', (e) => {
      if (!e.target.hasAttribute('data-vartiste-extra')) return;
      this.el.sceneEl.systems['file-upload'].handleURL(`${e.target.getAttribute('data-vartiste-extra-url')}/${this.data.category}/${e.target.getAttribute('data-vartiste-extra')}`, {forceReference: this.data.forceReference})
    })

    let rowCount = 0;
    for (let [url, index] of this.system.indices.entries())
    {
      for (let item of index[this.data.category])
      {
        let name = item.split(".", 1)[0]
        let row = document.createElement('a-entity')
        contents.append(row)
        row.setAttribute('icon-row', '')
        let button = document.createElement('a-entity')
        row.append(button)
        button.setAttribute('icon-button', '#asset-folder-open-outline')
        button.setAttribute('data-vartiste-extra-url', url)
        button.setAttribute('data-vartiste-extra', item)
        button.setAttribute('tooltip', `Load ${name}`)
        button.setAttribute('popup-action', 'close')

        let label = document.createElement('a-entity')
        row.append(label)
        label.setAttribute('text', `value: ${name}; anchor: left; width: 2.5; wrapCount: 20`)
        label.setAttribute('position', '0.4 0 0')
        rowCount++;
      }
    }

    if (shelf)
    {
      shelf.setAttribute('shelf', 'height', rowCount * 0.5 + 0.2)
    }
    this.populate = function() {};
  }
})

AFRAME.registerComponent('add-extras-edit-field', {
  events: {
    editfinished: function(e) {
      let value = this.el.getAttribute('text').value
      // this.el.sceneEl.components['vartiste-extras'].extraURLs

      if (!value.startsWith("http"))
      {
        value = "http://" + value;
      }

      this.el.sceneEl.setAttribute('vartiste-extras', {extraURLs: [].concat(this.el.sceneEl.components['vartiste-extras'].data.extraURLs, [value])})
      this.el.setAttribute('text', 'value', '')
    }
  },
  init() {
    this.el.setAttribute('edit-field', 'type: string; autoClear: true')
  }
})
