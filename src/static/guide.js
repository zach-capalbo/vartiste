require('./style.styl')
document.getElementById('content').innerHTML = require('./guide.md')
document.querySelectorAll('img').forEach(img => {
  if (img.height == 48) { console.log(img); img.classList.add("asset") }
})

// let scene = document.createElement('div')
// scene.innerHTML = require('../scene.html.slm')
// window.scene = scene
