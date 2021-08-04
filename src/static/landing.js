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
      twttr.widgets.load().catch(e => console.error("Couldn't fix tweets", e))

      // Work around twitter embed samesite cookie problem
      window.setTimeout(() => {
        console.log("Fixing height")
        document.querySelectorAll('*[title="Twitter Tweet"]').forEach(el => {
          if (el.style.height === '0px')
          {
            el.style.height = null
          }
        })
      }, 3000)
    }
    else
    {
      classList.add('collapsed')
    }
  })
})
