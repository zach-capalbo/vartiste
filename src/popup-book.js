import {Util} from './util.js'

const DISTANCE_FUNCTIONS = {
  linear: (x, d) => x * d.distance,
  logarithmic: (x, d) => Math.log(x + 1) * d.distance,
  exponential: (x, d) => Math.exp(d.distance * x) / Math.exp(1)
}

AFRAME.registerComponent('popup-book', {
  dependencies: ['grab-root', 'grab-activate'],
  schema: {
    distance: {default: 0.1},
    distanceFunction: {oneOf: Object.keys(DISTANCE_FUNCTIONS), default: 'linear'},

    geometrySize: {default: 5},
  },
  events: {
    activate: function(e) {
      Util.keepingWorldPosition(this.el.object3D, () => {
        this.el.object3D.parent.remove(this.el.object3D)
        document.getElementById('reference-spawn').object3D.add(this.el.object3D)
      })
      this.el.setAttribute('reference-glb', '')
    },
    cloned: function(e) {
      let el = e.detail.newEl
      el.getObject3D('mesh').traverse(o => {
        if (!o.material) return
        if (!o.material.map) return;
        if (o.material.map.image.tagName !== 'CANVAS') return;
        o.material.map.image = Util.cloneCanvas(o.material.map.image)
      })
      // Util.callLater(this.build)
    },
    bbuttonup: function(e) {
      this.build()
    }
  },
  init() {
    this.layerEls = []
    this.build = this.build.bind(this)
    this.mesh = new THREE.Group()
    this.el.setObject3D('mesh', this.mesh)
    Compositor.el.addEventListener('layeradded', this.build)
    Compositor.el.addEventListener('layerupdated', this.build)
    Compositor.el.addEventListener('layersmoved', this.build)
    Compositor.el.addEventListener('layerdeleted', this.build)
  },
  update(oldData) {
    this.build()
  },
  build() {
    console.log("Building popup")
    const geometrySize = this.data.geometrySize
    let i = 0;

    for (let el of this.layerEls)
    {
      this.el.removeChild(el)
      Util.recursiveDispose(el)
    }
    this.layerEls.length = 0

    for (let layer of Compositor.component.layers)
    {
      if (!layer.visible) continue;

      let gWidth = layer.width / Compositor.data.baseWidth * geometrySize
      let gHeight = layer.height / Compositor.data.baseWidth * geometrySize

      let el = document.createElement('a-entity')
      this.el.append(el)
      el.setAttribute('geometry', `primitive: plane; width: ${gWidth}; height: ${gHeight}`)
      el.setAttribute('material', {shader: 'flat'})
      el.setAttribute('layer-preview', AFRAME.utils.styleParser.stringify({compositor: `#${Compositor.el.id}`, layer: layer.id}))
      el.setAttribute('draw-canvas', {canvas: layer.canvas})
      el.setAttribute('canvas-updater', "throttle: 10")
      el.classList.add("canvas")
      el.setAttribute('position', `0 0 ${DISTANCE_FUNCTIONS[this.data.distanceFunction](i++, this.data)}`)
      el.setAttribute('scale', `${layer.transform.scale.x} ${layer.transform.scale.y} 1`)
      el.setAttribute('propogate-grab', '')
      console.log("Created popout layer", layer, layer.transform.scale)
      this.layerEls.push(el)
      Util.whenLoaded(el, () => {
        this.mesh.add(el.object3D)
      })
    }

    // Util.positionObject3DAtTarget(this.el.object3D, Compositor.el.object3D)
  }
})

Util.registerComponentSystem('popup-book-creator', {

})
