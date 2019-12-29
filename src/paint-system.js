AFRAME.registerSystem('paint-system', {
  schema: {
    color: {type: 'color', default: '#000'}
  },

  init() {
  },

  selectColor(color) {
    console.log("Setting color", color)
    this.data.color = color
    this.el.emit('colorchanged', {color})
  }
})
