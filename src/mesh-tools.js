import {Util} from './util.js'
import {Undo} from './undo.js'
import {Pool} from './pool.js'
import {BufferGeometryUtils} from './framework/BufferGeometryUtils.js'
import {THREED_MODES} from './layer-modes.js'

Util.registerComponentSystem('mesh-tools', {
  init()  {
    Pool.init(this)
  },
  exportAll() {
    Compositor.el.object3D.visible = false
    this.el.sceneEl.systems['settings-system'].export3dAction(document.getElementById('canvas-root').object3D)
    Compositor.el.object3D.visible = true
  },
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
  mergeByDistance(factor = 1.0e-2) {
    Compositor.meshRoot.traverse(o => {
      if (o.type === 'Mesh' || o.type === 'SkinnedMesh')
      {
        let mergedGeometry = BufferGeometryUtils.mergeVertices(o.geometry, factor)
        console.log(`Reducing geometry ${o.geometry.attributes.position.count} -> ${mergedGeometry.attributes.position.count}`)
        o.geometry = mergedGeometry
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
  applyTransformation() {
    let obj = Compositor.meshTransformRoot
    let parent = Compositor.meshRoot.parent
    obj.matrix.multiply(parent.matrix)
    parent.matrix.identity()
    Util.applyMatrix(parent.matrix, parent)
    Util.applyMatrix(obj.matrix, obj)
  },
  applyTranslation() {
    let mat = this.pool('mat', THREE.Matrix4)
    let obj = Compositor.meshRoot
    // mat.identity()
    // mat.copyPosition(obj.parent.matrix)
    // obj.matrix.multiply(mat)
    // obj.parent.position.set(0, 0, 0)
    // Util.applyMatrix(obj.matrix, obj)
    // obj.position.multiplyVectors(obj.parent.position, obj.parent.scale)
    // obj.position.applyQuaternion(obj.parent.quaternion)
    // obj.parent.position.set(0, 0, 0)
  },
  applyRotation() {
    let mat = this.pool('mat', THREE.Matrix4)
    let obj = Compositor.meshTransformRoot
    let parent = Compositor.meshRoot.parent
    mat.extractRotation(parent.matrix)
    obj.matrix.multiply(mat)
    parent.rotation.set(0, 0, 0)
    Util.applyMatrix(obj.matrix, obj)
  },
  applyScale() {
    let mat = this.pool('mat', THREE.Matrix4)
    let obj = Compositor.meshTransformRoot
    let parent = Compositor.meshRoot.parent
    obj.scale.copy(parent.scale)
    parent.scale.set(1, 1, 1)
  },
  applyTransformationToVertices() {
    let mat = this.pool('mat', THREE.Matrix4)
    let pos = this.pool('pos', THREE.Vector3)
    for (let mesh of Compositor.nonCanvasMeshes)
    {
      mat.copy(mesh.matrix)
      for (let parent = mesh.parent; parent && parent !== Compositor.meshRoot.parent; parent = parent.parent)
      {
        mat.premultiply(parent.matrix)
      }

      mesh.geometry.attributes.position.applyMatrix4(mat)
      mesh.geometry.attributes.position.needsUpdate = true

      if (mesh.geometry.attributes.normal)
      {
        mat.extractRotation(mat)
        mesh.geometry.attributes.normal.applyMatrix4(mat)
        mesh.geometry.attributes.normal.needsUpdate = true
      }

      mesh.geometry.computeBoundingBox()
      mesh.geometry.computeBoundingSphere()
    }

    Compositor.meshRoot.traverse(o => {
      if (o.matrix)
      {
        o.matrix.identity()
        Util.applyMatrix(o.matrix, o)
      }
    })
  },
  splitReferenceMeshes() {
    let positionHelper = this.pool('positionHelper', THREE.Object3D)
    if (!positionHelper.parent) this.el.sceneEl.object3D.add(positionHelper)
    let container = document.getElementById('reference-spawn')
    for (let el of document.querySelectorAll('.reference-glb'))
    {
      let meshes = Util.traverseFindAll(el.object3D, o => o.type === 'Mesh' || o.type === 'SkinnedMesh')
      for (let i = 1; i < meshes.length; ++i)
      {
        let mesh = meshes[i]
        let mat = new THREE.Matrix4
        Util.positionObject3DAtTarget(positionHelper, mesh)
        mat.copy(positionHelper.matrix)
        let entity = document.createElement('a-entity')
        entity.classList.add('clickable')
        entity.classList.add('reference-glb')
        container.append(entity)
        mesh.parent.remove(mesh)
        entity.setObject3D('mesh', mesh)
        Util.whenLoaded(entity, () => {
          Util.applyMatrix(mat, positionHelper)
          Util.positionObject3DAtTarget(mesh, positionHelper)
        })
      }
    }
  },
  cloneAsReference() {
    let el = document.createElement('a-entity')
    el.classList.add('reference-glb')
    el.classList.add('clickable')
    document.querySelector('#reference-spawn').append(el)

    // let material = Compositor.material.clone()
    let material = new THREE.MeshMatcapMaterial()

    for (let map of ['map'].concat(THREED_MODES))
    {
      if (!Compositor.material[map] || !Compositor.material[map].image) continue;
      console.log("Copying", map, Compositor.material[map])
      material[map] = Compositor.material[map].clone()
      material[map].image = Util.cloneCanvas(Compositor.material[map].image)
      material[map].needsUpdate = true
    }

    material.skinning = Compositor.nonCanvasMeshes.some(m => m.skeleton)

    material.needsUpdate = true

    let newObject = Compositor.meshRoot.clone(true)
    newObject.traverse(o => {
      if (o.material)
      {
        o.material = material
      }
      if (o.type === 'SkinnedMesh')
      {
        let base = Compositor.meshes.find(m => m.name === o.name)
        if (!base) return
        o.bind(new THREE.Skeleton(base.skeleton.bones.map(b => b.clone()), base.skeleton.boneInverses.map(i => new THREE.Matrix4().copy(i))), new THREE.Matrix4().copy(base.bindMatrix))
      }
    })
    Util.applyMatrix(Compositor.meshRoot.el.object3D.matrix, newObject)
    el.setObject3D('mesh', newObject)
    console.log("Setting new object", newObject)
  }
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
    mode: {oneOf: ["delete", "hide", "emit"], default: "hide"},
    far: {default: 0.6}
  },
  events: {
    stateadded: function(e) {
      if (e.detail === 'grabbed') {
        if (!this.el.hasAttribute('raycaster'))
        {
          this.el.setAttribute('raycaster', `objects: .canvas, .reference-glb; showLine: true; direction: 0 1 0; origin: 0 0 0; far: ${this.data.far}`)
          this.el.setAttribute('scalable-raycaster', "")
          this.el.setAttribute('line', `color: ${this.data.mode === 'delete' ? 'red' : 'yellow'}`)

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
          if (intersection.object.el.classList.contains("reference-glb") && Util.traverseFindAll(intersection.object.el.object3D, o => (o.visible && (o.type === 'Mesh' || o.type === 'SkinnedMesh'))).length === 1)
          {
            let originalParent = intersection.object.el.parentEl
            let originalEl = intersection.object.el
            Undo.push(() => originalParent.append(originalEl), {whenSafe: () => originalEl.destroy()})
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
        else if (this.data.mode === 'emit')
        {
          this.el.emit('meshtool', {intersection, object: intersection.object, el: intersection.object.el})
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
})

AFRAME.registerComponent('mesh-fill-tool', {
  events: {
    meshtool: function(e) {
      this.fillMesh(e.detail.object)
    }
  },
  init() {
    this.el.setAttribute('hide-mesh-tool', 'mode', 'emit')
  },
  fillMesh(mesh) {
    let destinationCanvas = Compositor.drawableCanvas
    if (!this.proc)
    {
      this.proc = new CanvasShaderProcessor({source: require('./shaders/vertex-fill.glsl'), vertexShader: require('./shaders/vertex-baker.vert')})
    }
    let proc = this.proc

    proc.setInputCanvas(destinationCanvas)

    let geometry = mesh.geometry.toNonIndexed()

    proc.vertexPositions = geometry.attributes.uv.array
    proc.hasDoneInitialUpdate = false

    proc.setUniform('u_color', 'uniform3fv', this.el.sceneEl.systems['paint-system'].brush.color3.toArray())

    // proc.createVertexBuffer({name: "a_color", list: geometry.attributes.color.array, size: geometry.attributes.color.itemSize})

    proc.initialUpdate()

    proc.update()

    let ctx = destinationCanvas.getContext("2d")
    ctx.drawImage(proc.canvas,
                  0, 0, proc.canvas.width, proc.canvas.height,
                  0, 0, destinationCanvas.width, destinationCanvas.height)

    // window.setTimeout(() => this.el.sceneEl.systems['canvas-fx'].applyFX("dilate"), 100)

    if (destinationCanvas.touch) destinationCanvas.touch()
  }
})

AFRAME.registerComponent('morph-lever', {
  schema: {
    name: {type: 'string'},
    value: {default: 0.0},
  },
  events: {
    anglechanged: function (e) {
      for (let mesh of Compositor.meshes) {
        if (mesh.morphTargetDictionary && (this.data.name in mesh.morphTargetDictionary))
        {
          mesh.morphTargetInfluences[mesh.morphTargetDictionary[this.data.name]] = e.detail.value
        }
      }
    }
  },
  init() {
    let label = document.createElement('a-entity')
    this.label = label
    label.setAttribute('text', `value: ${this.data.name}; align: center; anchor: center; wrapCount: 15; width: 0.8`)
    label.setAttribute('position', '0 0.2 0')
    this.el.append(label)

    let lever = document.createElement('a-entity')
    lever.setAttribute('lever', 'valueRange: 1 -1')
    this.el.append(lever)
  }
})

AFRAME.registerComponent('morph-target-shelf', {
  init() {
    Compositor.material.morphTargets = true
    Compositor.material.needsUpdate = true
    this.populate()
  },
  populate() {
    let container = this.el.querySelector(".morph-levers")
    // container.clear()
    let x = 0
    let y = 0
    let xSpacing = 0.9
    let ySpacing = 0.5

    let existingTargetValues = {}
    for (let mesh of Compositor.nonCanvasMeshes)
    {
      console.log("Adding mesh to morph targets", mesh.name)
      if (!mesh.morphTargetDictionary) continue;

      for (let name in mesh.morphTargetDictionary)
      {
        if (name in existingTargetValues)
        {
          mesh.morphTargetInfluences[mesh.morphTargetDictionary[name]] = existingTargetValues[name]
          continue
        }

        console.log("Adding morph target", name)

        existingTargetValues[name] = mesh.morphTargetInfluences[mesh.morphTargetDictionary[name]]
        let lever = document.createElement('a-entity')
        lever.setAttribute('position', `${x++ * xSpacing} ${y * ySpacing} 0`)
        lever.setAttribute('morph-lever', `name: ${name}; value: ${existingTargetValues[name]}`)
        lever.setAttribute('scale', '2 2 2')
        container.append(lever)
      }
    }

    container.setAttribute('position', `${-(x - 1) * xSpacing / 2} 0 0`)
    this.el.setAttribute('shelf', 'width', x * xSpacing)
  }
})
