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

// Scene-wide settings for the `drawable` component
AFRAME.registerSystem('drawable', {
  schema: {
    // If true, will automatically setup entities with the a-frame `cursor`
    // component to be able to draw
    drawWithCursorComponent: {default: false},
  },
  init() {
    if (this.data.drawWithCursorComponent) {
      AFRAME.components.cursor.dependencies.push('hand-draw-tool')
      document.querySelectorAll('*[cursor]').forEach(el => {
        if (!el.isEntity) return;
        el.setAttribute('hand-draw-tool', '')
      })
    }
  }
})

// Simple component to enable drawing on a 3D model. Will allow drawing to an
// object's existing color texture when used in conjunction with the [`hand-draw-tool`](#hand-draw-tool)
// or the [`pencil-tool`](#pencil-tool). If you use the [`vartiste-user-root`](#vartiste-user-root)
// component, then you're all set up for point-and-click drawing already!
//
// **Note:** Currently, this only works correctly on objects with a single
// material, or at least multiple materials that share the same `map` texture.
// It also requires a UV map. The quality of the drawing experience will depend
// on the quality of the UV unwrapping.
//
// If you need more advanced features (e.g., layers), please see the [`compositor`](#compositor) component
//
// Some examples of the `drawable` component in action (together with the [`gltf-entities` Blender exporter](#gltf-entities)):
//
// - [VARTISTE Physics Playground](https://glitch.com/edit/#!/fascinated-hip-period?path=index.html%3A251%3A38)
// - [Color Museum Proof-of-concept](https://glitch.com/edit/#!/fascinated-hip-period?path=color-temple.html%3A65%3A37)
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

    // If true, will turn meshes without pre-existing textures drawable. Set
    // this to false if you're drawing on a model with some un-textured
    // components.
    includeTexturelessMeshes: {default: true},

    // If true, this will attempt to use existing image resolutions, or canvases
    // from canvas textures
    useExisting: {default: false},
  },
  init() {
    this.hadCanvas = this.el.classList && this.el.classList.contains('canvas')
    this.el.classList.add('canvas')
  },
  remove() {
    if (!this.hadCanvas)
    {
      this.el.classList.remove('canvas')
    }

    if (!this.hadDrawCanvas)
    {
      this.el.removeAttribute('draw-canvas')
    }
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

    if (this.hadDrawCanvas === undefined) this.hadDrawCanvas = this.el.hasAttribute('draw-canvas')
    this.el.setAttribute('draw-canvas', {canvas: this.canvas})
  },
  tick(t,dt) {
    let originalImage = undefined;
    let traversalObject = this.data.traverse ? this.el.object3D : this.el.getObject3D('mesh');
    if (!traversalObject) return;
    traversalObject.traverse(o => {
      if (!o.material) return;
      if (!o.material.map && this.data.includeTexturelessMeshes)
      {
        o.material = o.material.clone()
        o.material.map = this.tex
        o.material.needsUpdate = true
        let ctx = this.tex.image.getContext('2d')
        ctx.fillStyle = "#" + o.material.color.getHexString()
        ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height)
        o.material.color.set(0xFFFFFF)
        return;
      }
      if (o.material.map !== this.tex)
      {
        if (originalImage && originalImage !== o.material.map.image)
        {
            console.error("Drawable currently only supports objects with a single texture. Results may be unexpected")
        }

        originalImage = o.material.map.image

        if (this.data.useExisting)
        {
          this.canvas.width = originalImage.width
          this.canvas.height = originalImage.height
          this.tex = new THREE.CanvasTexture(this.canvas)
          this.tex.encoding = this.el.sceneEl.getAttribute('renderer').colorManagement ? THREE.GammaEncoding : THREE.LinearEncoding
          this.canvas.touch = () => this.tex.needsUpdate = true
          this.el.setAttribute('draw-canvas', {canvas: this.canvas})
        }

        o.material = o.material.clone()

        let ctx = this.tex.image.getContext('2d')

        ctx.drawImage(o.material.map.image, 0, 0, ctx.canvas.width, ctx.canvas.height)

        if (o.material.map.flipY !== this.tex.flipY)
        {
          this.el.sceneEl.systems['canvas-fx'].applyFX('flip-y', ctx.canvas)
        }

        o.material.map = this.tex
        o.material.needsUpdate = true
      }
    })
  }
})
