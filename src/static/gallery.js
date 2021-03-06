const GALLERY_ENTRIES = [
  {section: 'Templates', entries: [
    {name: "paper", displayName: "Paper Template", quickLoad: true, description: "A paper sketching starter template. Great for sketching and drawing."},
    {name: "hubs_avatar", displayName:"Hubs Avatar", quickLoad: true, description: "Mozilla Hubs Avatar from the Mozilla Hubs team. Click here to draw your own hubs avatar!"},
    {name: "paint-template", displayName: "Painting Template", quickLoad: true, description: "An easel and a few pre-made paint brushes."},
    {name: "graffiti", displayName: "Graffiti Template", quickLoad: false, description: "A brick wall to paint on. Goes great with the spray can tool"},
    {name: "ai_style", displayName: 'AI Style Transfer', description: "A template to get started using AI style transfer for painting."},
  ]},
  {section: 'Artwork', entries: [
    {name: "sunshade", displayName: "Sunshade", description: "Virtual reality painting by Sufee Yama"},
    {name: "birdcup_c", displayName: "Flying Bird Cup", description: "Virtual Reality Animated Ceramics."},
    {name: "meredith", displayName: "Meredith", description: "Meredith the Moose" },
    //{name: "painting", displayName: "Paint Brush Example", description: "A sample painting with VARTISTE's node composition system showing how to get a paint brush effect using the bump map."},
  ]}
]

class Gallery {
  constructor(el)
  {
    this.el = el
    this.el.innerHTML = require('./gallery.html.slm')
    this.el.querySelectorAll('.gallery-entry').forEach(entry => {
      let name = entry.getAttribute('entry')
      entry.setAttribute('href', "index.html?load=" + require(`../gallery/${name}.vartistez`))

      try {
      // To preserve old links
      require(`../gallery/${name}.vartiste`)
    } catch (e) {}

      try {
        entry.querySelector('.preview').setAttribute('src', require(`../gallery/${name}.png`))
      }
      catch(e)
      {
        console.error(e)
      }
    })
  }
}

module.exports = {GALLERY_ENTRIES, Gallery}
