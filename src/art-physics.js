import {Util} from './util.js'

function whenVisible(el) {
  return new Promise((r, e) => {
    el.addEventListener('whenvisible', r, {once: true})
    el.setAttribute('when-visible', "")
  })
}

Util.registerComponentSystem('art-physics', {
  schema: {
    artPhysics: {default: false},
    scenePhysics: {default: false},
  },
  events: {
    'physx-started': function(e) {
      this.physxStarted = true
      console.log("Physics started.", this.data)
      if (this.data.artPhysics)
      {
        this.addArtPhysics()
      }
    }
  },
  init() {},
  update(oldData) {
    if (this.data.artPhysics || this.data.scenePhysics)
    {
      if (this.physxStarted && !this.el.sceneEl.systems.physx.running)
      {
        this.el.sceneEl.systems.physx.running = true
      }
      else if (!this.physxStarted)
      {
        this.el.sceneEl.systems.physx.startPhysX()
      }
    }
    else if (this.el.sceneEl.systems.physx.running)
    {
      this.el.sceneEl.systems.physx.running = false
    }
    // this.sceneEl.systems.physx.running = !this.sceneEl.systems.physx.running
  },
  startArtPhysics() {
    this.el.sceneEl.systems.physx.data.gravity = {x: 0, y: 0, z: 0}
    this.data.artPhysics = true
    this.el.sceneEl.systems.physx.startPhysX()
  },
  addArtPhysics() {
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
