import {Util} from './util.js'

Util.registerComponentSystem('vartiste-extras', {
  schema: {
    url: {default: 'https://zach-geek.gitlab.io/vartiste-extras/index.json'}
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
    let res = await fetch(this.data.url);
    this.index = await res.json()
    this.el.emit('vartisteextras', this.index)
  }
})
