require('./static/docs.styl')
import HighlightWorker from './doc-highlight.worker.js'
import 'highlight.js/styles/github.css'

window.HighlightWorker = HighlightWorker

document.querySelector('#readme').innerHTML = require('./toolkit/Readme.md')

let contentPromises = []
async function addDocumentation(src)
{
  src = src.split("/").slice(-1)[0].replace(/\.js$/g, "")
  let contentPromise = import(
    /* webpackInclude: /.*\.js$/ */
    /* webpackExclude: /(index)/ */
    /* _webpackChunkName: "my-chunk-name" */
    /* webpackMode: "eager" */
    /* webpackPrefetch: true */
    /* webpackPreload: true */
    `./${src}.js`
  )

  contentPromises.push(contentPromise)

  let html = await contentPromise

  document.getElementById('content').innerHTML += html.default
}

(require => {
  require('./util')
  require('./shelf')
  require('./icon-button')
  require('./edit-field')
  require('./popup-shelf')
  require('./tooltip')
  require('./frame')
  require('./optimization-components')
  require('./speech')
  require('./matcap-shader')
  require('./desktop-controls')
  require('./manipulator')
  require('./canvas-shader-processor')
  require('./canvas-updater')
  require('./demo-overlay');
  require('./joystick-directions');
  require('./popup-shelf');
  require('./smooth-controller');
  require('./vartiste-toolkit')
  require('./draw-canvas')
  require('./hand-draw-tool')
  require('./paint-system')
  require('./color-picker')
  require('./leap-hand')
  require('./hand-tracking')
  require('./hdri-environment')
  require('./fix-oculus-steamvr')
  require('./artist-positioning')
  require('./material-transformations')
  require('./canvas-fx')
  require('./scalable-raycaster')
  require('./webxr-input-profiles')
  require('./xr-controllers')
  require('./camera-capture')
  require('./undo')
  require('./physics')
})(addDocumentation)

Promise.all(contentPromises).then(a=> {
  let toc = document.createElement('ul')
  let lastH1List
  let entries = document.querySelectorAll('.docs h1, .docs h2')
  for (let el of entries)
  {
    if (el.tagName === 'H1') {
      let topLevel = document.createElement('li')
      lastH1List = document.createElement('ul')
      topLevel.innerHTML = `<a href="#${el.textContent}">${el.textContent}</a>`
      topLevel.append(lastH1List)
      toc.append(topLevel)
    }
    else
    {
      let li = document.createElement('li')
      li.innerHTML = el.innerHTML
      li.querySelector('a').remove()
      let code = li.querySelector('code')
      let link = document.createElement('a')
      link.href = `#${code.textContent}`
      link.append(code)
      li.innerHTML = `<span class='type'>${li.textContent}</span>`
      li.prepend(link)
      lastH1List.append(li)
    }
  }

  document.querySelector('#toc').append(toc);

  (async () => {
    let worker = new HighlightWorker;
    let currentResolve
    for (let block of document.querySelectorAll('pre > code'))
    {
      let html = await new Promise((r, e) => {
        worker.onmessage = r
        worker.postMessage(block.textContent)
      })
      block.innerHTML = html.data
    }
  })();

  console.log("All loaded")
})

window.hljs = require('highlight.js')
