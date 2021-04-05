import {Util} from './util.js'

Util.registerComponentSystem('art-physics', {
  events: {
    'physx-started': function(e) {
      this.addPhysics()
    }
  },
  init() {},
  addPhysics() {
    this.el.querySelectorAll('*[pencil-tool]').forEach(el => {
      el.setAttribute('pencil-tool', 'extraRayLength', 0.01)
      try {
        // el.components['pencil-tool'].activatePencil()
      } catch (e) {}
      el.components['pencil-tool'].updateDrawTool()
      el.setAttribute('physx-body', 'type: dynamic')
      el.setAttribute('dual-wieldable', '')
    })
    this.el.querySelector('#composition-view').setAttribute('physx-body', 'type: kinematic')
    Compositor.el.setAttribute('physx-body', 'type: kinematic')
  }
})
