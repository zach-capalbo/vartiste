import {Util} from './util.js'

AFRAME.registerComponent('popup-book', {
  dependencies: ['grab-root'],
  schema: {
    distance: {default: 1}
  },
  init() {
    this.build()
  },
  build() {
    console.log("Building popup")
    const geometrySize = 20
    let i = 0;

    for (let layer of Compositor.component.layers)
    {
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
      el.setAttribute('position', `0 0 ${i++ * this.data.distance}`)
      el.setAttribute('scale', `${layer.transform.scale.x} ${layer.transform.scale.y} 1`)
      el.setAttribute('propogate-grab', '')
      console.log("Created popout layer", layer, layer.transform.scale)
    }

    Util.positionObject3DAtTarget(this.el.object3D, Compositor.el.object3D)
  }
})
