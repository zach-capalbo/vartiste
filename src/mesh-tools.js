import {Util} from './util.js'

Util.registerComponentSystem('mesh-tools', {
  subdivide() {
    let mod = new THREE.SubdivisionModifier(2)
    Compositor.meshRoot.traverse(o => {
      if (o.type === 'Mesh' || o.type === 'SkinnedMesh')
      {
        o.geometry.fromGeometry(mod.modify(o.geometry))
      }
    })
  },
  simplify(factor = 0.5) {
    let mod = new THREE.SimplifyModifier()
    Compositor.meshRoot.traverse(o => {
      if (o.type === 'Mesh' || o.type === 'SkinnedMesh')
      {
        o.geometry = mod.modify(o.geometry, o.geometry.attributes.position.count * factor)
      }
    })
  },
  bakeToVertexColors() {
    for (let mesh of Compositor.meshes)
    {
      if (mesh === Compositor.el.getObject3D('mesh')) continue
      let vertexUvs = mesh.geometry.attributes.uv
      let uv = new THREE.Vector2()
      let colors = []
      let {width, height} = Compositor.component
      let flipY = Compositor.component.data.flipY
      let threeColor = new THREE.Color()
      let srgb = this.el.sceneEl.getAttribute('renderer').colorManagement
      for (let vi = 0; vi < vertexUvs.count; vi ++ )
      // let imageData = Compositor.component.preOverlayCanvas.getContext('2d').getImageData(0, 0, Compositor.component.width, Compositor.component.height)
      {
        let x = Math.round(uv.x * width)
        let y = Math.round(uv.y * height)
        if (flipY) y = Math.round((1.0 - uv.y) * height)
        uv.fromBufferAttribute(vertexUvs, vi)
        let color = Compositor.component.preOverlayCanvas.getContext('2d').getImageData(x, y, 1,1)

        if (srgb)
        {
          threeColor.setRGB(color.data[0] / 256.0, color.data[1] / 256.0, color.data[2] / 256.0)
          // threeColor.convertLinearToSRGB()
          colors.push(threeColor.r)
          colors.push(threeColor.g)
          colors.push(threeColor.b)
        }
        else
        {
          colors.push(color.data[0] / 255.0)
          colors.push(color.data[1] / 255.0)
          colors.push(color.data[2] / 255.0)
        }
      }
      mesh.geometry.setAttribute( 'color', new THREE.Float32BufferAttribute( colors, 3, true) );
      mesh.geometry.needsUpdate = true
    }
  },
  bakeVertexColorsToTexture() {
    Compositor.component.addLayer()
    let destinationCanvas = Compositor.drawableCanvas
    let proc = new CanvasShaderProcessor({source: require('./shaders/vertex-baker.glsl'), vertexShader: require('./shaders/vertex-baker.vert')})
    proc.setInputCanvas(destinationCanvas)

    for (let mesh of Compositor.meshes)
    {
      if (mesh === Compositor.el.getObject3D('mesh')) continue
      if (!mesh.geometry.attributes.uv || !mesh.geometry.attributes.color) continue
      let geometry = mesh.geometry.toNonIndexed()

      proc.vertexPositions = geometry.attributes.uv.array
      proc.hasDoneInitialUpdate = false

      proc.createVertexBuffer({name: "a_color", list: geometry.attributes.color.array, size: geometry.attributes.color.itemSize})

      proc.initialUpdate()

      proc.update()

      let ctx = destinationCanvas.getContext("2d")
      ctx.drawImage(proc.canvas,
                    0, 0, proc.canvas.width, proc.canvas.height,
                    0, 0, destinationCanvas.width, destinationCanvas.height)
    }

    if (destinationCanvas.touch) destinationCanvas.touch()
  },
})
