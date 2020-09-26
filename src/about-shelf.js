const buildInfo = require('!!val-loader!./build-info.js')

AFRAME.registerComponent('version-info', {
  dependencies: ['text'],
  init() {
    let versionText = `v${buildInfo.version} - ${new Date(buildInfo.date).toISOString().split('T')[0]}`
    this.el.setAttribute('text', {value: versionText})
  }
})
