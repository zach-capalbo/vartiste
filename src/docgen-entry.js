require('./static/docs.styl')

document.querySelector('#readme').innerHTML = require('./toolkit/Readme.md')

contentPromises = []
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
  require('./demo-overlay')
  require('./joystick-directions')
  require('./popup-shelf')
  require('./smooth-controller')
  require('./vartiste-toolkit')
  require('./draw-canvas')
  require('./hand-draw-tool')
  require('./paint-system')
  require('./color-picker')
  require('./leap-hand')
  require('./hand-tracking')
  require('./hdri-environment')
})(addDocumentation)

Promise.all(contentPromises).then(a=> console.log("All loaded"))
