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
  bakeVertexColorsToTexture({autoDilate = true} = {}) {
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

    if (autoDilate)
    {
      this.el.sceneEl.systems['canvas-fx'].applyFX("dilate", destinationCanvas)
    }

    if (destinationCanvas.touch) destinationCanvas.touch()
  },
})

AFRAME.registerSystem('hide-mesh-tool', {
  init() {
    this.hiddenObjects = []
  },
  unhideAll() {
    for (let object of this.hiddenObjects)
    {
      object.visible = true
    }
  }
})

AFRAME.registerComponent('hide-mesh-tool', {
  dependencies: ['six-dof-tool', 'grab-activate'],
  schema: {
    mode: {oneOf: ["delete", "hide"], default: "hide"},
    far: {default: 0.6}
  },
  events: {
    stateadded: function(e) {
      if (e.detail === 'grabbed') {
        if (!this.el.hasAttribute('raycaster'))
        {
          this.el.setAttribute('raycaster', `objects: .canvas, .reference-glb; showLine: true; direction: 0 1 0; origin: 0 0 0; far: ${this.data.far}`)
          this.el.setAttribute('line', `color: ${this.data.mode === 'delete' ? 'red' : 'yellow'}`)
          this.fixRayLine()
        }
        this.el.components.raycaster.play()
      }
    },
    stateremoved: function(e) {
      if (e.detail === 'grabbed') this.el.components.raycaster.pause()
    },
    click: function(e) {
      for (let intersection of this.el.components.raycaster.intersections)
      {
        if (this.data.mode === 'delete')
        {
          if (intersection.object.el.classList.contains("reference-glb"))
          {
            let originalParent = intersection.object.el.parent
            let originalEl = intersection.object.el
            Undo.push(() => originalParent.append(el), {whenSafe: () => originalEl.destroy()})
            intersection.object.el.remove()
          }
          else
          {
            let originalParent = intersection.object.parent
            let originalObject = intersection.object
            Undo.push(() => originalParent.add(originalObject))
            intersection.object.parent.remove(intersection.object)
          }
        }
        else
        {
          Undo.push(() => intersection.object.visible = true)
          intersection.object.visible = false
          this.system.hiddenObjects.push(intersection.object)
        }

        break
      }
    }
  },
  init() {
    this.el.classList.add('grab-root')
    this.handle = this.el.sceneEl.systems['pencil-tool'].createHandle({radius: 0.04, height: 0.3})
    this.el.append(this.handle)

    this.el.sceneEl.systems.manipulator.installConstraint(() => {
      this.el.components.raycaster.data.far = this.calcFar()
      this.updateRaycaster.call(this.el.components.raycaster)
    })
  },
  fixRayLine() {
    let worldScale = new THREE.Vector3
    this.el.components.raycaster.updateLine = AFRAME.utils.bind(function () {
      var el = this.el;
      var intersections = this.intersections;
      var lineLength;

      if (intersections.length) {
        this.el.object3D.getWorldScale(worldScale);
        let worldScaleFactor = Math.abs(worldScale.dot(this.data.direction));
        if (intersections[0].object.el === el && intersections[1]) {
          lineLength = intersections[1].distance / worldScaleFactor;
        } else {
          lineLength = intersections[0].distance / worldScaleFactor;
        }
      }
      this.drawLine(lineLength);
    }, this.el.components.raycaster);
  }
})
