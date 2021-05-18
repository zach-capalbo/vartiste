import {Util} from './util.js'

function whenVisible(el) {
  return new Promise((r, e) => {
    el.addEventListener('whenvisible', r, {once: true})
    el.setAttribute('when-visible', "")
  })
}

Util.registerComponentSystem('art-physics', {
  events: {
    'physx-started': function(e) {
      this.addPhysics()
    }
  },
  init() {},
  addPhysics() {
    this.el.querySelectorAll('*[pencil-tool]').forEach(async el => {
      await whenVisible(el)
      el.setAttribute('pencil-tool', 'extraRayLength', 0.001)
      try {
        // el.components['pencil-tool'].activatePencil()
      } catch (e) {}
      el.components['pencil-tool'].updateDrawTool()
      el.setAttribute('physx-body', 'type: dynamic; angularDamping: 10; linearDamping: 4')
      el.setAttribute('dual-wieldable', '')
    })
    this.el.querySelectorAll('.volume-tool').forEach(async el => {
      await whenVisible(el)
      el.setAttribute('physx-body', 'type: dynamic; angularDamping: 10; linearDamping: 4')
      el.setAttribute('dual-wieldable', '')
    })
    this.el.querySelector('#composition-view').setAttribute('physx-body', 'type: kinematic')
    Compositor.el.setAttribute('physx-body', 'type: kinematic')

    Util.callLater(async () => {
      await Compositor.el.components['physx-body'].physxRegisteredPromise;
      Compositor.el.getObject3D('mesh').position.z = 2.8
    })
  }
})
