const buildInfo = require('!!val-loader!./build-info.js')

AFRAME.registerSystem('vartiste-version-info', {
  init() {
    this.buildInfo = buildInfo
  }
})

AFRAME.registerComponent('version-info', {
  dependencies: ['text'],
  init() {
    let versionText = `VARTISTE v${buildInfo.version} - ${new Date(buildInfo.date).toISOString().split('T')[0]}`
    this.el.setAttribute('text', {value: versionText})
  }
})
