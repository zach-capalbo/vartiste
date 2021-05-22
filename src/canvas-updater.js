// Sets `needsUpdate = true` on the element's mesh's material at a throttled
// interval. *Note,* this will only update visible meshes.
AFRAME.registerComponent('canvas-updater', {
  dependencies: ['geometry', 'material'],
  schema: {
    // Minimum interval milliseconds between updates
    throttle: {type: 'int', default: 300}
  },

  init() {
    this._tick = this.tick
    if (this.data.throttle > 0)
    {
      this.tick = AFRAME.utils.throttleTick(this.tick, this.data.throttle + Math.random() * 100, this)
    }
  },

  tick(t, dt) {
    var el = this.el;
    var material;

    let parentVisible = true
    this.el.getObject3D('mesh').traverseAncestors(a => parentVisible = parentVisible && a.visible)
    if (!parentVisible) return false

    material = el.getObject3D('mesh').material;
    if (!material.map) { return; }
    if (material.map.image.getUpdateTime && material.map.image.getUpdateTime() < this.drawnT) return
    material.map.needsUpdate = true;
    this.drawnT = t
  }
});

// Simple component to enable drawing on a 3D model. Will allow drawing to an
// object's existing color texture when used in conjunction with the [`hand-draw-tool`](#hand-draw-tool)
// or the [`pencil-tool`](#pencil-tool)
//
// **Note:** Currently, this only works correctly on objects with a single
// material, or at least multiple materials that share the same `map` texture.
// It also requires a UV map. The quality of the drawing experience will depend
// on the quality of the UV unwrapping.
//
// If you need more advanced features (e.g., layers), please see the [`compositor`](#compositor) component
AFRAME.registerComponent('drawable', {
  schema: {
    // If set, will use an existing canvas as the draw target / material. If not
    // set, a canvas will be created internally
    canvas: {type: 'selector'},

    // Width of canvas to create if a canvas is needed
    canvasWidth: {default: 1024},

    // Height of canvas to create if a canvas is needed
    canvasHeight: {default: 1024},

    // If true, will traverse this element's object3D and set all materials and
    // objects to be drawable. If false, will only traverse the `getObject3D('mesh')`
    traverse: {default: false},
  },
  init() {
    this.el.classList.add('canvas')
  },
  update(oldData) {
    if (this.data.canvas)
    {
      this.canvas = this.data.canvas
    }
    else
    {
      if (this.canvas && oldData.canvas) {
        this.canvas = undefined
      }

      if (!this.canvas)
      {
          this.canvas = document.createElement('canvas')
      }

      this.canvas.width = this.data.canvasWidth
      this.canvas.height = this.data.canvasHeight
    }
    this.tex = new THREE.CanvasTexture(this.canvas)
    this.tex.encoding = this.el.sceneEl.getAttribute('renderer').colorManagement ? THREE.GammaEncoding : THREE.LinearEncoding
    this.canvas.touch = () => this.tex.needsUpdate = true

    this.el.setAttribute('draw-canvas', {canvas: this.canvas})
  },
  tick(t,dt) {
    let originalImage = undefined;
    let traversalObject = this.data.traverse ? this.el.object3D : this.el.getObject3D('mesh');
    traversalObject.traverse(o => {
      if (!o.material) return;
      if (!o.material.map) return;
      if (o.material.map !== this.tex)
      {
        if (originalImage && originalImage !== o.material.map.image)
        {
            console.error("Drawable currently only supports objects with a single texture. Results may be unexpected")
        }

        originalImage = o.material.map.image

        o.material = o.material.clone()
        let ctx = this.tex.image.getContext('2d')
        ctx.drawImage(o.material.map.image, 0, 0, ctx.canvas.width, ctx.canvas.height)
        o.material.map = this.tex
        o.material.needsUpdate = true
      }
    })
  }
})
