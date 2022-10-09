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

//AFRAME.components.raycaster.Component.prototype.updateLine = function(){}
// Improves global raycasting performance but decreases raycaster accuracy on skinned or morphed meshes.
Util.registerComponentSystem('optimize-mesh-raycast', {
  schema: {
    // When true, the raycaster will ignore the entity’s morph targets.
    // Helps reduce needed processing power.
    ignoreMorphTargets: {default: true},
    // When true, the raycaster will ignore the entity’s skinning.
    // Helps reduce needed processing power.
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
      if (this.material.length)
      {
        return oldRayCast.call(this, ...args)
      }
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
      if (o.geometry && !o.geometry.boundsTree && o.geometry.attributes.position && o.geometry.attributes.position.count > 6) {
        o.geometry.computeBoundsTree();
      }
    })
  },
  tick(t, dt) {}
})

// Controls the global low power setting for devices with limited processing
// power. By default, it will check the system in use and guess which setting
// will be best.
AFRAME.registerSystem('low-power', {
  schema: {
    // Explicitly setting this property to `true` or `false` will force the scene into or out of low power mode.
    lowPower: {default: Util.isLowPower()}
  },
  init() {
    console.info("Low power mode is", this.data.lowPower ? "on" : "off")
  },
  isLowPower() {
    return this.data.lowPower;
  }
})

// Sets the desired property and value for a given component when the scene is
// in low power mode. When you set the component property, the set-low-power schema
// will update, allowing you to specify properties on the component in a
// `property: value` format.
//
// Example:
//```<a-cube material="color: blue; shader: standard" set-low-power="component: material; color: red"></a-cube>```
AFRAME.registerComponent('set-low-power', {
  multiple: true,
  schema: {
    // The entity containing the desired component.
    target: {default: null},
    // The component affected by low power mode. When this is changed the `set-low-power-mode` schema will be updated to match the target component schema
    component: {type: 'string'},
  },
  updateSchema(newData) {
    let target = newData.target || this.el;
    if (!newData.component) return;

    let newSchema = {}

    for (let key in target.components[newData.component].schema)
    {
      newSchema[key] = {default: null}
    }
    this.extendSchema(newSchema)
  },
  update(oldData) {
    let target = this.data.target || this.el;
    if (!target || !this.data.component) return;
    if (!this.el.sceneEl.systems['low-power'].isLowPower()) return;
    let diff = {};
    AFRAME.utils.diff(oldData, this.data, diff)
    // Util.whenComponentInitialized(target, this.data.component, () => {
      for (let key in diff)
      {
        if (key === 'component' || key === 'target') continue;
        if (diff[key] === null) continue;
        target.setAttribute(this.data.component, key, diff[key])
      }
    // })
  }
})

AFRAME.registerComponent('hide-low-power', {
  init() {
    if (!this.el.sceneEl.systems['low-power'].isLowPower()) return;

    this.el.setAttribute('bypass-hidden-updates', '')
    this.el.setAttribute('visible', 'false')
  }
})

AFRAME.registerComponent('delete-low-power', {
  init() {
    if (!this.el.sceneEl.systems['low-power'].isLowPower()) return;

    Util.whenLoaded(this.el, () => {
      this.el.parentEl.removeChild(this.el)
    })
  }
})

AFRAME.registerComponent('simple-render-sort', {
  init() {
    if (this.el.sceneEl.renderer)
    {
      this.el.sceneEl.renderer.setOpaqueSort(function(a,b) { return a.z - b.z; })
      this.el.sceneEl.renderer.setTransparentSort(function(a,b) { return b.z - a.z; })
    }
  }
})

Util.registerComponentSystem('vr-render-scale', {
  schema: {
    renderScale: {default: 1.0},
    rememberRenderScale: {default: true},
    snapToDistance: {default: 0.06}
  },
  events: {
    'exit-vr': function(e) {
      this.el.renderer.xr.setFramebufferScaleFactor(this.data.renderScale)
    }
  },
  init() {
    if (this.data.rememberRenderScale)
    {
      let storedRenderScale = parseFloat(localStorage.getItem('renderScale') ?? this.data.renderScale)
      this.data.renderScale = storedRenderScale
    }
  },
  update(oldData) {
    if (this.data.renderScale !== oldData.renderScale)
    {
      console.log("Checking render scale distance", this.data.renderScale, Math.abs(this.data.renderScale - 1.0))
      if (Math.abs(this.data.renderScale - 1.0) < this.data.snapToDistance)
      {
        this.el.setAttribute('vr-render-scale', 'renderScale: 1.0')
        return;
      }

      if (Math.abs(this.data.renderScale - 2.0) < this.data.snapToDistance)
      {
        this.el.setAttribute('vr-render-scale', 'renderScale: 2.0')
        return;
      }

      if (Math.abs(this.data.renderScale - 1.5) < this.data.snapToDistance / 2)
      {
        this.el.setAttribute('vr-render-scale', 'renderScale: 1.5')
        return;
      }

      if (Math.abs(this.data.renderScale - 0.5) < this.data.snapToDistance / 2)
      {
        this.el.setAttribute('vr-render-scale', 'renderScale: 0.5')
        return;
      }
    }
    if (this.data.rememberRenderScale)
    {
      localStorage.setItem('renderScale', this.data.renderScale)
    }

    if (!this.el.is('vr-mode'))
    {
      console.log("Setting render scale", this.data.renderScale)
      this.el.renderer.xr.setFramebufferScaleFactor(this.data.renderScale)
    }
  }
})