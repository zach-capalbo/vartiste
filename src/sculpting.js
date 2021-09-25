import {Util} from './util.js'
import {Pool} from './pool.js'
import {VectorBrush, StretchBrush} from './brush.js'
import {Layer} from './layer.js'
import {Undo} from './undo.js'
import {ENABLED_MAP, HANDLED_MAPS} from './material-packs.js'

AFRAME.registerComponent('sculpt-move-tool', {
  dependencies: ['six-dof-tool', 'grab-activate'],
  schema: {
    boxSize: {type: 'vec3', default: {x: 0.2, y: 0.2, z: 0.2}},
    selector: {type: 'string', default: '#composition-view, .reference-glb, .canvas'},
    undoable: {default: false},
  },
  events: {
    stateadded: function(e) {
      if (e.detail === 'grabbed')
      {
        this.startGrab()
      }
    },
    stateremoved: function(e) {
      if (e.detail === 'grabbed')
      {
        this.stopGrab()
      }
    },
    click: function(e) {
      this.toggleGrabbing(!this.grabbing)
    }
  },
  init() {
    this.el.classList.add('grab-root')
    this.handle = this.el.sceneEl.systems['pencil-tool'].createHandle({radius: 0.07, height: 0.3})
    this.el.append(this.handle)
    Pool.init(this)

    let box = document.createElement('a-box')
    this.box = box
    box.classList.add('clickable')
    box.setAttribute('material', 'color: #333; shader: matcap; wireframe: true')
    this.el.append(box)
    this.grabbing = false

    // this.box.setAttribute('axis-handles', "")
  },
  update(oldData) {
    this.box.setAttribute('width', this.data.boxSize.x)
    this.box.setAttribute('height', this.data.boxSize.y)
    this.box.setAttribute('depth', this.data.boxSize.z)
    this.box.setAttribute('position', {x: 0, y: this.data.boxSize.y / 2, z: 0})

    if (this.data.grabElements && this.data.duplicateOnGrab)
    {
      throw new Error("Duplicating elements doesn't work yet")
    }
  },
  toggleGrabbing(newGrabbing) {
    if (this.grabbing === newGrabbing) return;
    this.grabbing = newGrabbing;
    this.box.setAttribute('material', 'color', this.grabbing ? '#6fde96' : "#333")
    if (this.grabbing && this.el.is('grabbed'))
    {
      this.startGrab()
    }
    else if (this.el.is('grabbed'))
    {
      this.stopGrab()
    }
  },
  selectObjects() {
    let objects = document.querySelectorAll(this.data.selector)
    if (!this.data.grabElements)
    {
      let newObjects = []
      for (let el of objects)
      {
        Util.traverseFindAll(el.object3D, o => o.type === 'Mesh' || o.type === 'SkinnedMesh', {outputArray: newObjects, visibleOnly: true})
      }
      objects = newObjects.map(o => { return {object3D: o}})
    }
    return objects
  },
  preprocessContainedTarget(target) {},
  startGrab() {
    let objects = this.selectObjects();
    this.grabbers = {}
    this.grabbed = {}
    this.grabberId = {}

    this.box.getObject3D('mesh').geometry.computeBoundingBox()
    let boundingBox = this.box.getObject3D('mesh').geometry.boundingBox

    let worldPos = this.pool('worldPos', THREE.Vector3)
    let localPos = this.pool('localPos', THREE.Vector3)
    for (let el of objects) {
      let target = el

      if (target === this.el) continue
      if (target.object3D.uuid in this.grabbers) continue

      if (this.data.grabElements)
      {
        el.object3D.getWorldPosition(worldPos)
        localPos.copy(worldPos)
        this.box.getObject3D('mesh').worldToLocal(localPos)
        if (!boundingBox.containsPoint(localPos)) continue
      }
      else
      {
        let contained = false
        for (let i = 0; i < el.object3D.geometry.attributes.position.count; ++i)
        {
          worldPos.fromBufferAttribute(el.object3D.geometry.attributes.position, i)
          el.object3D.localToWorld(worldPos)
          this.box.getObject3D('mesh').worldToLocal(worldPos)
          if (boundingBox.containsPoint(worldPos))
          {
            contained = true
            break
          }
        }
        if (!contained) continue
      }

      this.preprocessContainedTarget(target)

      if (this.data.duplicateOnGrab)
      {
        let oldObject = target.object3D
        let newObject = oldObject.clone(true)
        oldObject.parent.add(newObject)
        target.object3D = newObject
      }

      let obj = new THREE.Object3D
      this.el.object3D.add(obj)
      Util.positionObject3DAtTarget(obj, target.object3D)
      this.grabbers[target.object3D.uuid] = obj
      this.grabbed[obj.uuid] = target
      this.grabberId[obj.uuid] = obj

      if (this.grabVertices)
      {
        let grabChild = new THREE.Object3D
        target.object3D.add(grabChild)
        this.grabChildren[obj.uuid] = grabChild
      }
    }
    if (Object.values(this.grabbed).length > 0) {
      Undo.collect(() => {
        if (this.data.duplicateOnGrab)
        {
            for (let o of Object.values(this.grabbed))
            {
              Undo.push(() => o.parent.remove(o))
            }
            return;
        }

        for (let o of Object.values(this.grabbed))
        {
          Undo.pushObjectMatrix(o.object3D)
        }
      })
    }
    this.tick = this._tick;
  },
  stopGrab() {
    this.tick = function(){};
    if (this.data.duplicateOnGrab && this.grabbing)
    {
      this.toggleGrabbing(false)
    }
  },
  tick(t,dt) {},
  _tick(t, dt) {
    if (!this.el.is('grabbed')) return
    if (!this.grabbing) return

  }
})

AFRAME.registerSystem('vertex-handle', {
  init() {
    this.grabbed = new Set()
    this.selectors = []
  },
  tick(t, dt) {
    for (let v of this.grabbed.values())
    {
      v.move(t,dt)
    }
  }
})

AFRAME.registerComponent('vertex-handle', {
  schema: {
    vertex: {type: 'int'},
    vertices: {type: 'array'},
    mesh: {default: null},
    attribute: {default: 'position', oneOf: ['position', 'uv']},
    offset: {default: 2},
    drawLines: {default: true},
  },
  events: {
    stateadded: function (e) {
      if (e.detail === 'grabbed')
      {
        this.startGrab()
      }
    },
    stateremoved: function(e) {
      if (e.detail === 'grabbed')
      {
        this.stopGrab()
      }
    }
  },
  init() {
    this.el.setAttribute('geometry', 'primitive: tetrahedron; radius: 0.04')
    this.el.setAttribute('grab-options', 'showHand: false; undoable: true')
    this.el.setAttribute('material', 'color: #e58be5; shader: matcap')
    this.el.classList.add('clickable')

    this.startPosition = new THREE.Vector3
  },
  remove() {
    this.el.object3D.parent.remove(this.el.object3D)
  },
  update(oldData) {
    if (this.data.vertices.length === 0)
    {
      this.vertices = [this.data.vertex]
      this.isSequential = true
    }
    else
    {
      this.vertices = this.data.vertices.map(i => parseInt(i))
      this.isSequential = true
      for (let i = 1; i < this.vertices.length; ++i)
      {
        if (this.vertices[i - 1] !== this.vertices[i])
        {
          this.isSequential = false;
          break
        }
      }
    }

    Util.whenLoaded(this.el.parentEl, () => {
      this.resetPosition()
    })
  },
  resetPosition() {
    if (!this.mesh)
    {
      this.mesh = this.data.mesh || this.el.parentEl.getObject3D('mesh')
      if (this.mesh.type !== 'Mesh' && this.mesh.type !== 'SkinnedMesh')
      {
        return;
      }

      if (this.data.attribute === 'position')
      {
        this.mesh.parent.add(this.el.object3D)
      }
    }

    if (this.data.attribute === 'position')
    {
      // Util.applyMatrix(this.mesh.matrix, this.el.object3D)
      this.el.object3D.position.fromBufferAttribute(this.mesh.geometry.attributes.position, this.vertices[0])
      this.el.object3D.position.applyMatrix4(this.mesh.matrix)
      if (!this.mesh.matrixInverse)
      {
        this.mesh.matrixInverse = new THREE.Matrix4
      }
      this.mesh.matrixInverse.copy(this.mesh.matrix).invert()
    }
    else if (this.data.attribute === 'uv')
    {
      Compositor.el.object3D.add(this.el.object3D)
      this.el.object3D.position.fromBufferAttribute(this.mesh.geometry.attributes.uv, this.vertices[0])
      this.el.object3D.position.x -= 0.5
      this.el.object3D.position.y -= 0.5
      this.el.object3D.position.x *= Compositor.el.getAttribute('geometry').width
      this.el.object3D.position.y *= - Compositor.el.getAttribute('geometry').height
      this.el.object3D.position.z = this.data.offset

      if (this.data.drawLines)
      {
        this.el.setAttribute('grab-options', 'scalable: false; lockRotation: true')
        this.el.setAttribute('line', `start: 0 0 0; end: 0 0 -${2 * this.data.offset}`)
      }
    }

  },
  startGrab() {
    if (!this.mesh)
    {
      console.warn("Grabbed vertex before mesh was set")
      return;
    }

    // this.startNormal.fromBufferAttribute(this.mesh.geometry.attributes.normal, this.vertices[0])

    this.system.grabbed.add(this)
  },
  stopGrab() {
    this.system.grabbed.delete(this)
  },
  move(t,dt)
  {
    if (this.data.attribute === 'position')
    {
      this.el.object3D.position.applyMatrix4(this.mesh.matrixInverse)
      for (let v of this.vertices)
      {
        this.mesh.geometry.attributes.position.setXYZ(v, this.el.object3D.position.x, this.el.object3D.position.y, this.el.object3D.position.z)
      }
      this.el.object3D.position.applyMatrix4(this.mesh.matrix)
      this.mesh.geometry.attributes.position.needsUpdate = true
      this.mesh.geometry.computeVertexNormals()
      this.mesh.geometry.computeFaceNormals()
      let normalOffset = this.mesh.geometry.attributes.normalOffset
      if (normalOffset)
      {
        for (let i = 0; i < normalOffset.array.length; ++i)
        {
          this.mesh.geometry.attributes.normal.array[i] += normalOffset.array[i]
        }
      }
      this.mesh.geometry.attributes.normal.needsUpdate = true
    }
    else if (this.data.attribute === 'uv')
    {
      let x = this.el.object3D.position.x / Compositor.el.getAttribute('geometry').width + 0.5
      let y = - this.el.object3D.position.y / Compositor.el.getAttribute('geometry').height + 0.5
      for (let v of this.vertices)
      {
        this.mesh.geometry.attributes.uv.setXY(v, x, y)
      }
      this.mesh.geometry.attributes.uv.needsUpdate = true

      if (this.data.drawLines)
      {
        this.el.setAttribute('line', 'end', `0 0 -${this.el.object3D.position.z}`)
      }
    }
  }
})

AFRAME.registerComponent('vertex-handles', {
  schema: {
    cloneGeometry: {default: false},
    mergeVertices: {default: true},
    offsetNormal: {default: true},
    throttle: {default: 500},
    attribute: {default: 'position'},
    drawLines: {default: false},
  },
  init() {
    this.handles = []
    this.meshes = []
    this.system = this.el.sceneEl.systems['vertex-handle']
    this.tick = AFRAME.utils.throttleTick(this.tick, this.data.throttle, this)
    this.meshLines = new Map();

    for (let mesh of Util.traverseFindAll(this.el.getObject3D('mesh'), o => o.type === 'Mesh' || o.type === 'SkinnedMesh'))
    {
      this.setupMesh(mesh)
    }
  },
  async setupMesh(mesh) {
    if (!mesh)
    {
      console.warn("Can't set vertex handles before mesh yet")
      return;
    }

    console.log("Setting up vertex handles for mesh", mesh)

    if (this.data.cloneGeometry)
    {
      mesh.geometry = mesh.geometry.clone()
    }

    let attr, p1, p2;
    let scale = new THREE.Vector3;
    if (this.data.attribute === 'position')
    {
      attr = mesh.geometry.attributes.position;
      p2 = new THREE.Vector3;
      p1 = new THREE.Vector3;
      mesh.parent.getWorldScale(scale);

      if (this.data.offsetNormal)
      {
        mesh.geometry.setAttribute('normalOffset', mesh.geometry.attributes.normal.clone())

        mesh.geometry.computeVertexNormals()
        mesh.geometry.computeFaceNormals()
        let normalOffset = mesh.geometry.attributes.normalOffset
        for (let i = 0; i < normalOffset.array.length; ++i)
        {
          let o = normalOffset.array[i]
          normalOffset.array[i] = o - mesh.geometry.attributes.normal.array[i]
          mesh.geometry.attributes.normal.array[i] = o
        }
      }
    }
    else if (this.data.attribute === 'uv')
    {
      attr = mesh.geometry.attributes.uv;
      p1 = new THREE.Vector2
      p2 = new THREE.Vector2
      Compositor.el.object3D.getWorldScale(scale);
    }

    if (!attr)
    {
      console.warn("No attribute for", this.data.attribute, mesh)
      return
    }


    let skipSet = new Set();
    let nearVertices = []

    let useBVH = this.data.attribute === 'position' && attr.count >= 200

    let bvh
    if (useBVH) {
      console.info("Using BVH for bounds")
      bvh = mesh.geometry.computeBoundsTree()
    }

    scale = 0.004 / Math.max(scale.x, scale.y, scale.z)
    console.log("Scale", scale)

    let meshLine = {mesh}
    if (this.data.drawLines && this.data.attribute === 'uv')
    {
      meshLine.elIndex = this.handles.length
      meshLine.geometry = new THREE.BufferGeometry()
      meshLine.attr = new THREE.BufferAttribute(new Float32Array(mesh.geometry.index.count * 3), 3, false)
      meshLine.geometry.setAttribute('position', meshLine.attr)
      meshLine.line = new THREE.Line(meshLine.geometry, new THREE.LineBasicMaterial({color: new THREE.Color('#e58be5')}))
      this.meshLines.set(mesh, meshLine)
      Compositor.el.object3D.add(meshLine.line)
    }

    let selectors = this.system.selectors.slice()
    let selectedSet

    if (selectors.length)
    {
      selectedSet = new Set();

      for (let s of selectors)
      {
        s.selectPoints(mesh, selectedSet)
      }
    }

    let itCount = attr.count;
    let i;
    if (selectedSet)
    {
      selectedSet = Array.from(selectedSet)
      itCount = selectedSet.length
    }

    for (let ii = 0; ii < itCount; ++ii)
    {
      if (selectedSet)
      {
        i = selectedSet[ii]
      }
      else
      {
        i = ii;
      }

      if ((ii + 1) % 100 === 0)
      {
        await Util.callLater()
      }
      if (skipSet.has(i)) continue;

      let el = document.createElement('a-entity')
      this.el.append(el)
      this.handles.push(el)

      if (this.data.mergeVertices)
      {
        const mergeDistance = 0.001;
        nearVertices = [i]
        p1.fromBufferAttribute(attr, i)

        if (!useBVH)
        {
          for (let j = i + 1; j < attr.count; ++j)
          {
            p2.fromBufferAttribute(attr, j)
            if (p1.distanceTo(p2) < mergeDistance)
            {
              nearVertices.push(j)
              skipSet.add(j)
            }
          }
        }
        else
        {
          let indexAttr = mesh.geometry.index
          bvh.shapecast(null, {
            intersectsBounds: function(box, isLeaf, score, depth, idx) {
              if (box.containsPoint(p1))
              {
                return 2
              }
              return 0
            },
            intersectsTriangle: function(triangle, index, contained, depth) {
              const i3 = 3 * index;
    				const a = i3 + 0;
    				const b = i3 + 1;
    				const c = i3 + 2;
    				const va = indexAttr.getX( a );
    				const vb = indexAttr.getX( b );
    				const vc = indexAttr.getX( c );
              if (triangle.a.distanceTo(p1) < mergeDistance)
              {
                nearVertices.push(va)
                skipSet.add(va)
                // console.log("Merge", i, va, index, p1.toArray(), triangle.a.toArray())
              }
              if (triangle.b.distanceTo(p1) < mergeDistance)
              {
                nearVertices.push(vb)
                skipSet.add(vb)
              }
              if (triangle.c.distanceTo(p1) < mergeDistance)
              {
                nearVertices.push(vc)
                skipSet.add(vc)
              }
              return false;
            }
          })
        }

        el.setAttribute('vertex-handle', 'attribute', this.data.attribute)
        el.setAttribute('vertex-handle', 'mesh', mesh)
        el.setAttribute('vertex-handle', 'vertices', nearVertices)
      }
      else
      {
        el.setAttribute('vertex-handle', 'attribute', this.data.attribute)
        el.setAttribute('vertex-handle', 'mesh', mesh)
        el.setAttribute('vertex-handle', 'vertices', [i])
      }
      Util.whenLoaded(el, () => el.setAttribute('geometry', 'radius', scale))
      this.meshes.push(mesh)
    }
  },
  remove() {
    for (let el of this.handles)
    {
      this.el.removeChild(el)
    }
    this.meshes.length = 0

    if (this.uvLayer)
    {
      Compositor.component.deleteLayer(this.uvLayer)
      this.uvLayer = undefined
    }
  },
  tick(t, dt)
  {
    if (!this.data.drawLines || this.data.attribute !== 'uv')
    {
      return;
    }

    for (let mesh of this.meshes)
    {
        let meshLine = this.meshLines.get(mesh);
        for (let i = 0; i < meshLine.mesh.geometry.index.count; ++i)
        {
          let v = meshLine.mesh.geometry.index.array[i];
          if (v + meshLine.elIndex > this.handles.length || !this.handles[v + meshLine.elIndex])
          {
            // console.log("OOB", v, meshLine.elIndex)
            continue
          }
          let pos = this.handles[v + meshLine.elIndex].object3D.position;
          meshLine.attr.setXYZ(v, pos.x, pos.y, pos.z)
        }
        meshLine.attr.needsUpdate = true
    }
    // for (let mesh of this.meshes)
    // {
    //     let meshLine = this.meshLines.get(mesh);
    //     for (let i = meshLine.elIndex; i < meshLine.attr.count; ++i)
    //     {
    //       let pos = this.handles[i].object3D.position;
    //       meshLine.attr.setXYZ(i - meshLine.elIndex, pos.x, pos.y, pos.z)
    //     }
    //     meshLine.attr.needsUpdate = true
    // }
  }
})

Util.registerComponentSystem('cutout-canvas', {
  schema: {
    extrude: {default: true},
  },
  events: {
    shapecreated: function(e) {
      this.handleShape(e.detail)
    }
  },
  init() {
    this.cutBrush = new VectorBrush('vector')
  },
  handleShape(shape)
  {
    let geometry;

    if (this.data.extrude)
    {
      const extrudeSettings = {
      	steps: 1,
      	depth: 0.002,
      	bevelEnabled: false,
      	bevelThickness: 1,
      	bevelSize: 1,
      	bevelOffset: 0,
      	bevelSegments: 1,
        curveSegments: 3
      };
      geometry = new THREE.ExtrudeBufferGeometry(shape, extrudeSettings)
    }
    else
    {
      geometry = new THREE.ShapeBufferGeometry(shape, 3)
    }
    let uvAttr = geometry.attributes.uv
    let uv = new THREE.Vector2()
    for (let i = 0; i < uvAttr.count; ++i)
    {
      uv.fromBufferAttribute(uvAttr, i)
      uv.x = uv.x / Compositor.component.width
      uv.y = uv.y / Compositor.component.height
      uvAttr.setXY(i, uv.x, - uv.y)
    }

    let scaleMatrix = new THREE.Matrix4;
    scaleMatrix.makeScale(
      1.0 / Compositor.component.width,
      Compositor.el.getAttribute('geometry').height / Compositor.component.height / Compositor.el.getAttribute('geometry').width,
      // Compositor.component.height / Compositor.el.getAttribute('geometry').height * Compositor.component.height / Compositor.component.width,
      1,
    )
    console.log("ScaleMatrix", scaleMatrix.elements)
    geometry.attributes.position.applyMatrix4(scaleMatrix)

    let mesh = new THREE.Mesh(geometry, Compositor.material)
    // mesh.scale.x = Compositor.component.width / Compositor.el.getAttribute('geometry').width
    // mesh.scale.y = Compositor.component.height / Compositor.el.getAttribute('geometry').height * Compositor.component.height / Compositor.component.width
    this.el.sceneEl.systems['settings-system'].addModelView({scene: mesh}, {replace: true, undo: true})

    if (this.oldBrush)
    {
      this.el.sceneEl.systems['paint-system'].selectBrush(this.oldBrush)
      this.oldBrush = null
    }
  },
  startCutout() {
    this.oldBrush = this.el.sceneEl.systems['paint-system'].brush
    this.el.sceneEl.systems['paint-system'].selectBrush(this.cutBrush)
  }
})

Util.registerComponentSystem('vertex-editing', {
  schema: {
    editMeshVertices: {default: false},
    editMeshUVs: {default: false},
  },
  events: {
    startdrawing: function(e) {
      this.el.setAttribute('vertex-editing', 'editMeshUVs', false)
    },
    layerupdated: function(e) {
      this.el.setAttribute('vertex-editing', 'editMeshUVs', false)
    }
  },
  init() {
    this.tick = AFRAME.utils.throttleTick(this.tick, 200, this)
  },
  update(oldData) {
    if (this.data.editMeshVertices !== oldData.editMeshVertices)
    {
      if (this.data.editMeshVertices)
      {
        for (let m of Compositor.nonCanvasMeshes)
        {
          m.el.setAttribute('vertex-handles', '')
        }
      }
      else
      {
        for (let m of Compositor.nonCanvasMeshes)
        {
          m.el.removeAttribute('vertex-handles')
        }
      }
    }
    if (this.data.editMeshUVs !== oldData.editMeshUVs)
    {
      if (this.data.editMeshUVs)
      {
        for (let m of Compositor.nonCanvasMeshes)
        {
          m.el.setAttribute('vertex-handles', 'attribute: uv')
        }
      }
      else
      {
        for (let m of Compositor.nonCanvasMeshes)
        {
          m.el.removeAttribute('vertex-handles')
        }

        if (this.uvLayer)
        {
          Compositor.component.deleteLayer(this.uvLayer)
          delete this.uvLayer
        }
      }
    }
  },
  tick(t, dt) {
    if (this.data.editMeshUVs)
    {
      if (!this.uvLayer)
      {
        this.uvLayer = new Layer(Compositor.component.width, Compositor.component.height)
        Compositor.component.addLayer(undefined, {layer: this.uvLayer})
      }
      Compositor.component.activeLayer.canvas.getContext('2d').clearRect(0, 0, Compositor.component.activeLayer.canvas.width, Compositor.component.activeLayer.canvas.height)
      this.el.sceneEl.systems['uv-unwrapper'].drawUVs()
      Compositor.component.activeLayer.touch()
    };
  }
})

const FORWARD = new THREE.Vector3(0, 0, 1)
AFRAME.registerComponent('threed-line-tool', {
  dependencies: ['six-dof-tool', 'grab-activate'],
  schema: {
    meshContainer: {type: 'selector', default: '#world-root'},
    switchbackAngle: {default: 80.0},
    pointToPoint: {default: false},
  },
  events: {
    activate: function(e) {
      Util.callLater(() => {
        this.initialScale = this.el.object3D.scale.x
      })
    },
    click: function(e) {
      return;

      let tipWorld = this.pool('tipWorld', THREE.Vector3)
      this.tipPoint.getWorldPosition(tipWorld)
      this.points.push({
        x: tipWorld.x,
        y: tipWorld.y,
        z: tipWorld.z,
        fx: 0,
        fy: 0,
        fz: 1,
        scale: 1
      })
      this.createMesh(this.points)
    },
    triggerdown: function(e) {
      if (!this.data.pointToPoint) return;
      let tipWorld = this.pool('tipWorld', THREE.Vector3)
      this.tipPoint.getWorldPosition(tipWorld)
      this.points.push({
        x: tipWorld.x,
        y: tipWorld.y,
        z: tipWorld.z,
        fx: 0,
        fy: 0,
        fz: 1,
        scale: Math.pow(0.8 * this.el.object3D.scale.x / this.initialScale, 2)
      })

      this.points.push({
        x: tipWorld.x,
        y: tipWorld.y,
        z: tipWorld.z,
        fx: 0,
        fy: 0,
        fz: 1,
        scale: Math.pow(0.8 * this.el.object3D.scale.x / this.initialScale, 2)
      })

      this.tiggerConstraint = this.el.sceneEl.systems.manipulator.installConstraint(this.el, () => {
        this.tipPoint.getWorldPosition(tipWorld)
        this.tipPoint.getWorldDirection(this.worldForward)

        this.points[1].x = tipWorld.x
        this.points[1].y = tipWorld.y
        this.points[1].z = tipWorld.z
        this.points[1].scale = Math.pow(0.8 * this.el.object3D.scale.x / this.initialScale, 2)

        for (let i = 0; i <= 1; ++i)
        {
          this.points[i].fx = this.worldForward.x
          this.points[i].fy = this.worldForward.y
          this.points[i].fz = this.worldForward.z

        }

        this.createMesh(this.points)
      })
    },
    triggerup: function(e) {
      console.log("Trigger up")
      if (!this.data.pointToPoint) return;
      this.doneDrawing()
      this.el.sceneEl.systems.manipulator.removeConstraint(this.el, this.tiggerConstraint)
    },
    draw: function(e) {
      if (this.data.pointToPoint) return;
      if (!this.endDrawingEl)
      {
        this.endDrawingEl = e.detail.sourceEl;

        this.endDrawingEl.addEventListener('enddrawing', this.doneDrawing)
      }

      let tipWorld = this.pool('tipWorld', THREE.Vector3)
      let worldScale = this.pool('worldScale', THREE.Vector3)
      this.tipPoint.getWorldDirection(this.worldForward)
      this.tipPoint.getWorldPosition(tipWorld)

      let oldVec = this.pool('oldVec', THREE.Vector3)
      let newVec = this.pool('newVec', THREE.Vector3)

      if (this.points.length > 3)
      {
        oldVec.set(this.points[this.points.length - 1].x - this.points[this.points.length - 2].x,
                   this.points[this.points.length - 1].y - this.points[this.points.length - 2].y,
                   this.points[this.points.length - 1].z - this.points[this.points.length - 2].z)

        newVec.set(tipWorld.x - this.points[this.points.length - 1].x,
                   tipWorld.y - this.points[this.points.length - 1].y,
                   tipWorld.z - this.points[this.points.length - 1].z)

        let angle = oldVec.angleTo(newVec) * 180 / Math.PI;
        if (angle > this.data.switchbackAngle || angle < - this.data.switchbackAngle)
        {
          console.log("Switchback", angle, oldVec, newVec)
          this.doneDrawing()
          return;
        }
        else if (oldVec.distanceTo(newVec) < 0.1)
        {
          // return;
          // console.log("NoSwitchback", angle, oldVec, newVec)
        }
      }

      this.points.push({
        x: tipWorld.x,
        y: tipWorld.y,
        z: tipWorld.z,
        fx: this.worldForward.x,
        fy: this.worldForward.y,
        fz: this.worldForward.z,
        scale: e.detail.pressure * Math.pow(0.8 * this.el.object3D.scale.x / this.initialScale, 2)
      })
      this.createMesh(this.points)
    },
    stateadded: function(e) {
      if (e.detail === 'grabbed') {
        this.el.sceneEl.systems['pencil-tool'].lastGrabbed = this

        if (this.el.grabbingManipulator.el.id === 'mouse')
        {
          this.mouseConstraint = this.el.sceneEl.systems.manipulator.installConstraint(this.el, () => {
            let tipWorld = this.pool('tipWorld', THREE.Vector3)
            this.tipPoint.getWorldPosition(tipWorld)
            this.points.push({
              x: tipWorld.x,
              y: tipWorld.y,
              z: tipWorld.z,
              fx: 0,
              fy: 0,
              fz: 1,
              scale: 1
            })
            this.createMesh(this.points)
          })
        }
      }
    },
    stateremoved: function(e) {
      if (e.detail === 'grabbed') {
        if (this.mouseConstraint)
        {
          this.el.sceneEl.systems.manipulator.removeConstraint(this.el, this.mouseConstraint)
          this.doneDrawing()
        }

        this.makePrimitives()
        // this.makeReference()
      }
    }
  },
  init() {
    Pool.init(this)
    this.doneDrawing = this.doneDrawing.bind(this)
    this.el.classList.add('grab-root')
    this.handle = this.el.sceneEl.systems['pencil-tool'].createHandle({radius: 0.05, height: 0.5, segments: 8, parentEl: this.el})
    let tipHeight = 0.3
    let tip = this.tip = this.data.pointToPoint ? document.createElement('a-sphere') : document.createElement('a-cone')
    this.el.append(tip)
    tip.setAttribute('radius-top', 0)
    tip.setAttribute('radius-bottom',  0.05)
    tip.setAttribute('radius',  0.05)
    tip.setAttribute('segments-height', this.data.pointToPoint ? 6 : 2)
    tip.setAttribute('segments-radial', 8)
    tip.setAttribute('height', tipHeight)
    tip.setAttribute('position', `0 ${tipHeight / 2.0} 0`)
    tip.setAttribute('material', 'shader: matcap; src: #asset-shelf')
    let tipPoint = this.tipPoint = new THREE.Object3D();
    tip.object3D.add(tipPoint);
    tipPoint.position.set(0, this.data.pointToPoint ? 0 : tipHeight / 2.0, 0);
    tipPoint.rotation.set(- Math.PI / 2, 0, 0);
    this.el.sceneEl.systems['button-caster'].install(['trigger'])

    this.el.setAttribute('six-dof-tool', 'orientation', new THREE.Vector3(0, 1, 0))

    this.points = []
    this.meshes = []

    this.vertexPositions = []
    this.uvs = []
    this.opacities = []
    this.normals = []

    this.point1 = new THREE.Vector3
    this.point2 = new THREE.Vector3
    this.point3 = new THREE.Vector3
    this.direction = new THREE.Vector3
    this.direction2 = new THREE.Vector3
    this.startPoint = new THREE.Vector3

    this.worldForward = new THREE.Vector3

    Util.whenLoaded(this.el, () => {
      this.initialScale = this.el.object3D.scale.x
    })
  },
  createMesh(points, {maxDistance = 100} = {}) {
    if (points.length < 2) return;
    let {point1, point2, point3, direction, direction2} = this
    this.vertexPositions.length = 0
    this.uvs.length = 0
    this.opacities.length = 0
    this.normals.length = 0
    let distance = 0
    let segDistance = 0
    let accumDistance = 0
    let discontinuity = false
    for (let i = 0; i < points.length - 1; ++i)
    {
      point1.set(points[i].x, points[i].y, points[i].z)
      point2.set(points[i + 1].x, points[i + 1].y, points[i + 1].z)
      point2.sub(point1)
      distance += point2.length()
    }

    let forward = this.worldForward;

    this.startPoint.set(0, 0, 0)
    for (let i = 0; i < points.length; ++i)
    {
      this.startPoint.x += points[i].x
      this.startPoint.y += points[i].y
      this.startPoint.z += points[i].z
    }

    this.startPoint.multiplyScalar(1.0 / points.length)

    for (let i = 0; i < points.length - 1; ++i)
    {
      forward.set(points[i].fx, points[i].fy, points[i].fz)
      forward.multiplyScalar(-1)
      point1.set(points[i].x, points[i].y, points[i].z)
      point2.set(points[i + 1].x, points[i + 1].y, points[i + 1].z)

      point1.sub(this.startPoint)
      point2.sub(this.startPoint)

      direction.subVectors(point2, point1)
      segDistance = direction.length()

      const directionScalar = 0.03

      if (segDistance > maxDistance)
      {
        discontinuity = true;
        continue
      }

      if (i === 0 || discontinuity)
      {
        direction.normalize()
        direction.cross(forward)
        direction.multiplyScalar(points[i].scale * directionScalar)
      }
      else
      {
        direction.copy(direction2)
      }

      if (i < points.length - 2)
      {
        point3.set(points[i + 2].x, points[i + 2].y, points[i + 2].z)
        point3.sub(this.startPoint)
        direction2.subVectors(point3, point2)
        direction2.normalize()
        direction2.cross(forward)
        direction2.multiplyScalar(points[i+1].scale * directionScalar)
        direction2.lerp(direction, 0.5)
      }
      else
      {
        direction2.copy(direction)
      }

      discontinuity = false

      let uvStart = accumDistance
      accumDistance += segDistance / distance
      let uvEnd = accumDistance

      // Tri 1
      this.vertexPositions.push(point1.x + direction.x, point1.y + direction.y, point1.z + direction.z)
      this.vertexPositions.push(point2.x - direction2.x, point2.y - direction2.y, point2.z - direction2.z)
      this.vertexPositions.push(point1.x - direction.x, point1.y - direction.y, point1.z - direction.z)

      this.uvs.push(uvStart, 0,
                    uvEnd, 1,
                    uvStart, 1)

      // this.opacities.push(
      //   points[i].opacity,
      //   points[i+1].opacity,
      //   points[i].opacity,
      // )

      // forward.multiplyScalar(-1)

      this.normals.push(forward.x, forward.y, forward.z)
      this.normals.push(forward.x, forward.y, forward.z)
      this.normals.push(forward.x, forward.y, forward.z)


      // Tri 2
      this.vertexPositions.push(point2.x - direction2.x, point2.y - direction2.y, point2.z - direction2.z)
      this.vertexPositions.push(point1.x + direction.x, point1.y + direction.y, point1.z + direction.z)
      this.vertexPositions.push(point2.x + direction2.x, point2.y + direction2.y, point2.z + direction2.z)

      this.uvs.push(uvEnd, 1,
                    uvStart, 0,
                    uvEnd, 0)

      this.normals.push(forward.x, forward.y, forward.z)
      this.normals.push(forward.x, forward.y, forward.z)
      this.normals.push(forward.x, forward.y, forward.z)

      // this.opacities.push(
      //   points[i + 1].opacity,
      //   points[i].opacity,
      //   points[i + 1].opacity,)
    }

    this.geometry = new THREE.BufferGeometry()
    this.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.vertexPositions), 3, false))
    this.geometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(this.uvs), 2, true))
    this.geometry.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(this.normals), 3, false))

    let material = this.getMaterial(distance)

    if (this.mesh)
    {
      this.mesh.parent.remove(this.mesh)
    }

    this.mesh = new THREE.Mesh(this.geometry, material)
    this.data.meshContainer.object3D.add(this.mesh)
    this.mesh.position.copy(this.startPoint)
  },
  doneDrawing() {
    if (this.endDrawingEl)
    {
      this.endDrawingEl.removeEventListener('enddrawing', this.doneDrawing)
      this.endDrawingEl = null
    }
    if (this.mesh) {
      this.meshes.push(this.mesh)
    }
    let mesh = this.mesh
    Undo.push(() => {
      if (mesh.el)
      {
        mesh.el.remove()
      }
      else
      {
        mesh.parent.remove(mesh)
      }
      this.meshes.splice(this.meshes.indexOf(mesh), 1)
    })
    this.mesh = null
    this.points.length = 0
    this.vertexPositions = []
    this.uvs = []
    this.opacities = []
    this.normals = []
    this.material = null
  },
  getMaterial(distance) {
    if (this.material) return this.material
    let brush = this.el.sceneEl.systems['paint-system'].brush;

    let canvas, color, opacity;

    let transparent = true;

    if (brush instanceof StretchBrush)
    {
      canvas = brush.image
      color = new THREE.Color(brush.color3)
      color.convertSRGBToLinear()
      opacity = brush.opacity
      canvas = Util.cloneCanvas(canvas)

      if (!Util.isLowPower())
      {
        transparent = !Util.isCanvasFullyOpaque(canvas)
      }
    }
    else
    {
      canvas = document.createElement('canvas')
      canvas.width = 256
      canvas.height = 64

      let ctx = canvas.getContext('2d')

      if (brush.startDrawing)
      {
        brush.startDrawing(ctx, 0, 0.5 * canvas.height)
      }

      let pointCount = 40
      for (let i = 1; i < pointCount; ++i)
      {
        brush.drawTo(ctx, i / pointCount * canvas.width, 0.5 * canvas.height)
      }

      if (brush.endDrawing)
      {
        brush.endDrawing(ctx)
      }

      canvas = Util.autoCropCanvas(canvas)

      if (!Util.isLowPower())
      {
        transparent = !Util.isCanvasFullyOpaque(canvas)
      }
    }

    if (opacity < 1.0) transparent = true;

    let texture = new THREE.Texture;
    texture.image = canvas
    texture.needsUpdate = true
    texture.encoding = THREE.sRGBEncoding
    texture.generateMipmaps = false
    texture.minFilter = THREE.LinearFilter
    let materialType = THREE.MeshBasicMaterial;

    switch (Compositor.el.getAttribute('material').shader)
    {
      case 'standard': materialType = THREE.MeshStandardMaterial; break;
      // case 'matcap': materialType = THREE.MeshMatcapMaterial; break;
    }

    if (this.el.sceneEl.systems['material-pack-system'].activeMaterialMask)
    {
      materialType = THREE.MeshStandardMaterial
    }

    // materialType = THREE.MeshNormalMaterial;

    this.material = new materialType({map: texture, transparent: transparent, depthWrite: !transparent, color, opacity, side: THREE.DoubleSide})

    if (this.el.sceneEl.systems['material-pack-system'].activeMaterialMask)
    {
      let maps = this.el.sceneEl.systems['material-pack-system'].activeMaterialMask.maps
      let maskData = this.el.sceneEl.systems['material-pack-system'].activeMaterialMask.data
      for (let map in maps)
      {
        if (!maskData[ENABLED_MAP[map]]) continue;
        if (maps[map].id && maps[map].id.startsWith('default-')) continue;
        if (map === 'src') {
          console.log("Painting over canvas")
          let ctx = canvas.getContext('2d')
          let globalCompositeOperation = ctx.globalCompositeOperation
          ctx.globalCompositeOperation = 'source-in'
          ctx.drawImage(maps[map], 0, 0, maps[map].width, maps[map].height,
                                   0, 0, canvas.width, canvas.height)
          ctx.globalCompositeOperation = globalCompositeOperation
          this.material.map.needsUpdate = true
          continue;
        }
        texture = new THREE.Texture;
        texture.image = maps[map]
        texture.needsUpdate = true
        texture.encoding = THREE.sRGBEncoding
        texture.generateMipmaps = false
        texture.minFilter = THREE.LinearFilter
        this.material[map] = texture
      }
      this.material.needsUpdate = true
    }

    return this.material;
  },
  makePrimitives() {
    if (!this.meshes.length) return;
    let placeholder = new THREE.Object3D
    this.el.sceneEl.object3D.add(placeholder)

    for (let mesh of this.meshes) {
      let el = document.createElement('a-entity')
      this.el.sceneEl.append(el)
      el.classList.add('clickable')
      mesh.el = el
      Util.positionObject3DAtTarget(placeholder, mesh)
      el.object3D.add(mesh)
      el.setObject3D('mesh', mesh)
      Util.positionObject3DAtTarget(mesh, placeholder)
      el.object3D.position.copy(mesh.position)
      mesh.position.set(0, 0, 0)
      el.setAttribute('primitive-construct-placeholder', 'manualMesh: true; detached: true;')
    }

    this.meshes = []
  },
  makeReference() {
    if (!this.meshes.length) return;

    let el = document.createElement('a-entity')
    document.querySelector('#reference-spawn').append(el)
    el.classList.add('clickable')
    let targetObj = new THREE.Object3D;
    el.setObject3D('mesh', targetObj);

    let placeholder = new THREE.Object3D
    this.el.sceneEl.object3D.add(placeholder)

    let meshes = this.meshes
    this.meshes = []

    Util.whenLoaded(el, () => {
      el.object3D.updateMatrixWorld()
      for (let mesh of meshes)
      {
        Util.positionObject3DAtTarget(placeholder, mesh)
        mesh.el = el
        targetObj.add(mesh)
        Util.positionObject3DAtTarget(mesh, placeholder)
      }
      el.setAttribute('reference-glb', '')
      // el.setAttribute('primitive-construct-placeholder', 'detached: true; manualMesh: true')

    })
  }
})
