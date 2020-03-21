require('./style.styl')
document.getElementById('content').innerHTML = require('./instructions.md')

const {Gallery} = require('./gallery')
new Gallery(document.getElementById('gallery-content'))
