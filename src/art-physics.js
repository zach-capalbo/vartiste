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
      // let tip = el.components['pencil-tool'].tip
      // let tipHeight = tip.getAttribute('height')
      // if (!tipHeight) return;

      // tipHeight = parseFloat(tipHeight)
      // tip.setAttribute('height', tipHeight / 2)
      // tip.object3D.position.y += tipHeight / 4

      el.setAttribute('physx-body', 'type: dynamic; angularDamping: 10; linearDamping: 4; mass: 0.01; shapeOffset: 0 0.05 0')
      el.setAttribute('dual-wieldable', '')

      // await el.components['physx-body'].physxRegisteredPromise

      // tip.setAttribute('height', tipHeight)
      // tip.object3D.position.y -= tipHeight / 4
    })
    this.el.querySelectorAll('.volume-tool').forEach(async el => {
      await whenVisible(el)
      el.setAttribute('physx-body', 'type: dynamic; angularDamping: 10; linearDamping: 4')
      el.setAttribute('dual-wieldable', '')
    })
    Compositor.el.setAttribute('physx-body', 'type: kinematic')
    this.el.querySelector('#composition-view').setAttribute('physx-body', 'type: dynamic; mass: 100; angularDamping: 10; linearDamping: 4')

    this.el.querySelectorAll('.reference-glb').forEach(el => {
      el.setAttribute('physx-body', 'type: dynamic; angularDamping: 10; linearDamping: 4')
      el.setAttribute('dual-wieldable', '')
    })

    Util.callLater(async () => {
      await Compositor.el.components['physx-body'].physxRegisteredPromise;
      Compositor.el.getObject3D('mesh').position.z = 2.8
    })
  }
})
