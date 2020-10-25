((replaceText) => {
if (!replaceText) return
require('aframe-troika-text')
const TEXT_SCHEMA = AFRAME.components['text'].schema
delete AFRAME.components.text

AFRAME.registerComponent('text', {
  dependencies: ['troika-text'],
  schema: Object.assign({}, TEXT_SCHEMA,{
    font: {default: "https://fonts.gstatic.com/s/nunito/v14/XRXW3I6Li01BKofA6sKUYevO.woff"}
  }),
  update(oldData) {
    let troikaData = {}

    for (let propName in this.data)
    {
      if (propName in AFRAME.components['troika-text'].schema)
      {
        troikaData[propName] = this.data[propName]
      }
    }

    if (this.data.width == 'auto')
    {
      troikaData.maxWidth = 1
    }
    else if (this.data.width)
    {
      troikaData.maxWidth = this.width
    }

    if (this.data.zOffset)
    {
      this.el.components['troika-text'].troikaTextMesh.position.z = this.data.zOffset
    }

    this.el.setAttribute('troika-text', troikaData)
  }
})

// AFRAME.components['text'] = AFRAME.components['vartiste-text']
})(false)
