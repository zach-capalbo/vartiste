const GALLERY_ENTRIES = [
  {name: "hubs_avatar", displayName:"Hubs Avatar", description: "Mozilla Hubs Avatar from the Mozilla Reality team."}
]

class Gallery {
  constructor(el)
  {
    this.el = el
    this.el.innerHTML = require('./gallery.html.slm')
    this.el.querySelectorAll('.gallery-entry').forEach(entry => {
      let name = entry.getAttribute('entry')
      entry.setAttribute('href', "index.html?load=" + require(`../gallery/${name}.vartiste`))
      entry.querySelector('.preview').setAttribute('src', require(`advanced-image-loader!../gallery/${name}.png?width=200`))
    })
  }
}

module.exports = {GALLERY_ENTRIES, Gallery}
