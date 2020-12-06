import {Util} from './util.js'

Util.registerComponentSystem('animation-3d', {
  schema: {
    frameCount: {default: 50},
  },
  init() {
    this.morphKeyFrames = {}
  }
})
