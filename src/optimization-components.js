import {Util} from './util.js'
require('./framework/raycast-bvh.js')

// Adding this component to an element will make the render loop skip updating this
// element and all of its children. Can give a considerable performance benefit
// when there are a lot of hidden objects.
AFRAME.registerComponent('bypass-hidden-updates', {
  init() {
    let _updateMatrixWorld = this.el.object3D.updateMatrixWorld
    this.el.object3D.updateMatrixWorld = function () {
      if (!this.visible) {
        return
      }
      _updateMatrixWorld.apply(this)
    }
  }
})

// The audio listener really slows down chrome for some reason. Let's just get
// rid of it
AFRAME.registerComponent('remove-audio-listener', {
  init() {
    this.el.object3D.traverse(o => {
      if (o.type === 'AudioListener')
      {
        o.parent.remove(o)
      }
    });
  }
})

// Forces a light component to update its shadow after 2 sceonds. Works around
// situations where setting the shadow camera properties don't stick for some
// reason
AFRAME.registerComponent('fix-light-shadow', {
  events: {
    componentchanged: function(e) {
      if (this.el.sceneEl.time > 2000) {
        this.el.components['light'].updateShadow();
      }
    }
  },
  init() {
    VARTISTE.Util.whenLoaded(this.el, () => {
      // this.el.components['light'].updateShadow()
    })
  },
  tick(t, dt) {
    if (t > 2000) {
      this.el.components['light'].updateShadow();
      this.tick = function() {};
    }
  }
})


// Fixes a performance regression raycasting against a skinned mesh without a
// skinning material
Util.registerComponentSystem('optimize-mesh-raycast', {
  schema: {
    ignoreMorphTargets: {default: true},
    ignoreSkinning: {default: false},
  },
  init() {
    this.oldRayCast = THREE.Mesh.prototype.raycast

  },
  update() {
    var wasSkinned = false
    var wasMorphed = false
    var oldRayCast = this.oldRayCast
    var data = this.data
    THREE.Mesh.prototype.raycast = function(...args) {
      wasSkinned = this.isSkinnedMesh
      this.isSkinnedMesh = this.isSkinnedMesh && this.material.skinning && !data.ignoreSkinning

      wasMorphed = this.material.morphTargets
      this.material.morphTargets = this.material.morphTargets && !data.ignoreMorphTargets
      let res = oldRayCast.call(this, ...args)
      this.isSkinnedMesh = wasSkinned
      this.material.morphTargets = wasMorphed
      return res
    }
  }
})

// Uses [three-mesh-bvh](https://github.com/gkjohnson/three-mesh-bvh) to
// significantly improve raycasting performance for this entity's mesh (or
// child meshes recursively)
AFRAME.registerComponent('raycast-bvh', {
  schema: {
    // If throttle is greater or equal to 0, it will check periodically for any
    // ungenerated BVH bounds trees, and generate them automatically. Otherwise,
    // it will only generate bounds trees when `object3dset` is emitted.
    throttle: {default: -1},
  },
  events: {
    object3dset: function(e) {
      this.compute()
    }
  },
  init() {
    if (this.el.getObject3D('mesh')) this.compute();
  },
  update(oldData) {
    if (this.data.throttle >= 0)
    {
      this.tick = AFRAME.utils.throttleTick(this.compute, this.data.throttle, this)
    }
    else
    {
      this.tick = function(){};
    }
  },
  compute() {
    this.el.object3D.traverse(o => {
      if (o.geometry && !o.geometry.boundsTree) {
        o.geometry.computeBoundsTree();
      }
    })
  },
  tick(t, dt) {}
})
