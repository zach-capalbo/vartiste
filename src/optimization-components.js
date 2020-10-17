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
