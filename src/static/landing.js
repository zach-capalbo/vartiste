require('./style.styl')
document.getElementById('content').innerHTML = require('./instructions.md')

const {Gallery} = require('./gallery')
new Gallery(document.getElementById('gallery-content'))

require('!!file-loader?name=preview.jpg!./images/fullscreen.jpg')

document.getElementById('features-content').innerHTML = require('./features.html.slm')
document.querySelectorAll('.expand-feature').forEach(el => {
  el.addEventListener('click', (e) => {
    let classList = el.parentElement.querySelector('ul').classList;
    if (classList.contains('collapsed'))
    {
      classList.remove('collapsed')

      el.parentElement.querySelectorAll('.collapsed-tweet').forEach(tweetEl => {
        tweetEl.innerHTML = tweetEl.getAttribute('data-html')
        tweetEl.classList.remove('collapsed-tweet')
      })
      twttr.widgets.load()
    }
    else
    {
      classList.add('collapsed')
    }
  })
})
