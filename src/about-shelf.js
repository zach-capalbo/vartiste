var buildInfo;

// buildInfo = require('!!val-loader!./build-info.js')
try {
 buildInfo = require('./built-info.js')
}
catch (e)
{
 buildInfo = {
   version: "DEV",
   date: new Date().toString()
 }
}

AFRAME.registerSystem('vartiste-version-info', {
  init() {
    this.buildInfo = buildInfo
  }
})

AFRAME.registerComponent('version-info', {
  dependencies: ['text'],
  init() {
    let versionText = `${buildInfo.version} - ${new Date(buildInfo.date).toISOString().split('T')[0]}`
    this.el.setAttribute('text', {value: versionText})
  }
})
