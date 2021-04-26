import {Util} from './util.js'
import {Undo} from './undo.js'
import {Pool} from './pool.js'
import {BufferGeometryUtils} from './framework/BufferGeometryUtils.js'
import {THREED_MODES} from './layer-modes.js'
import './framework/TessellateModifier'

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
        mod.modify(o.geometry).toBufferGeometry(o.geometry)
      }
    })
  },
  tessalate() {
    let mod = new THREE.TessellateModifier(0.01)
    Compositor.meshRoot.traverse(o => {
      if (o.type === 'Mesh' || o.type === 'SkinnedMesh')
      {
        o.geometry = mod.modify(o.geometry)
      }
    })
  },
  simplify(factor = 0.5) {
    let mod = new THREE.SimplifyModifier()
    Compositor.meshRoot.traverse(o => {
      if (o.type === 'Mesh' || o.type === 'SkinnedMesh')
      {
        let desiredCount = Math.round(o.geometry.attributes.position.count * factor)
        let modified = mod.modify(o.geometry, desiredCount)
        console.log("Modified geometry", desiredCount, o.geometry, modified)
        o.geometry = modified
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
  bakeVertexColorsToTexture({autoDilate = true, layer = undefined} = {}) {
    if (layer)
    {
      Compositor.component.activateLayer(layer)
    }
    else
    {
      Compositor.component.addLayer()
    }
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

    let material = Compositor.material.clone()
    // let material = new THREE.MeshMatcapMaterial()

    for (let map of ['map'].concat(THREED_MODES))
    {
      if (map === 'envMap') continue
      if (!Compositor.material[map] || !Compositor.material[map].image) continue;
      console.log("Copying", map, Compositor.material[map])
      try {
        material[map] = Compositor.material[map].clone()
        material[map].image = Util.cloneCanvas(Compositor.material[map].image)
        material[map].needsUpdate = true
      } catch (e) {
        console.warn("Couldn't clone map", map, e)
        material[map] = null
        material.needsUpdate = true
      }
    }

    // material.skinning = Compositor.nonCanvasMeshes.some(m => m.skeleton)

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
  },
  bakeMorphTarget() {
    let p = new THREE.Vector3()
    let m = new THREE.Vector3()
    let o = new THREE.Vector3()
    let seenGeometries = new Set()
    for (let mesh of Compositor.nonCanvasMeshes)
    {
      if (!mesh.morphTargetInfluences) continue;
      if (seenGeometries.has(mesh.geometry)) continue
      let attribute = mesh.geometry.attributes.position
      let originalPositions = mesh.geometry.morphTargetsRelative ? null : attribute.clone()

      for (let morphIndex in mesh.morphTargetInfluences)
      {
        let influence = mesh.morphTargetInfluences[morphIndex]
        if (influence === 0.0) continue;

        let morphAttribute = mesh.geometry.morphAttributes['position'][morphIndex]

        for (let i = 0; i < attribute.count; ++i)
        {
          p.fromBufferAttribute(attribute, i)
          m.fromBufferAttribute(morphAttribute, i)

          if ( mesh.geometry.morphTargetsRelative ) {
    				p.addScaledVector(m, influence);
    			} else {
            o.fromBufferAttribute(originalPositions, i)
    				p.addScaledVector(m.sub(o), influence);
    			}
          attribute.setXYZ(i, p.x, p.y, p.z)
        }

        mesh.morphTargetInfluences[morphIndex] = 0
      }
      attribute.needsUpdate = true
      seenGeometries.add(mesh.geometry)
    }
  },
  actualScale() {
    Util.applyMatrix(Compositor.meshRoot.el.object3D.matrix.identity(), Compositor.meshRoot.el.object3D)
    let p = new THREE.Vector3
    Compositor.meshRoot.el.object3D.getWorldPosition(p)
    Compositor.meshRoot.el.object3D.position.y -= p.y
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
    far: {default: 1.6},
    objects: {default: '.canvas, .reference-glb'}
  },
  events: {
    stateadded: function(e) {
      if (e.detail === 'grabbed') {
        console.log("Grabbing mesh tool")
        if (!this.el.hasAttribute('raycaster'))
        {
          console.log("setting raycaster", this.data.objects)
          this.el.setAttribute('raycaster', `objects: ${this.data.objects}; showLine: true; direction: 0 1 0; origin: 0 0 0; near: 0.0; far: ${this.data.far}; lineColor: ${this.data.mode === 'delete' ? 'red' : 'yellow'}`)
          this.el.setAttribute('scalable-raycaster', "")

        }
        this.el.components.raycaster.play()
      }
    },
    stateremoved: function(e) {
      if (e.detail === 'grabbed') this.el.components.raycaster.pause()
    },
    click: function(e) {
      console.log("Checking intersections",  this.el.components.raycaster.intersections)
      for (let intersection of this.el.components.raycaster.intersections)
      {
        console.log("Checking",  intersection)
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
  schema: {
    autoDilate: {default: true},
  },
  events: {
    meshtool: function(e) {
      this.fillMesh(e.detail.object)
    }
  },
  init() {
    this.el.setAttribute('hide-mesh-tool', 'mode', 'emit')
  },
  fillMesh(mesh) {
    console.log("Filling mesh")
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

    if (this.data.autoDilate)
    {
      this.el.sceneEl.systems['canvas-fx'].applyFX('dilate')
    }

    if (destinationCanvas.touch) destinationCanvas.touch()
  }
})

AFRAME.registerComponent('scissors-tool', {})
