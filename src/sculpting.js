import {Util} from './util.js'
import {Pool} from './pool.js'
import {VectorBrush} from './brush.js'

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
    offset: {default: 0},
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
    this.el.setAttribute('grab-options', 'showHand: false')
    this.el.setAttribute('material', 'color: #e58be5; shader: flat')
    this.el.classList.add('clickable')

    this.startPosition = new THREE.Vector3
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
      this.el.object3D.position.y *= Compositor.el.getAttribute('geometry').height
      this.el.object3D.position.z = this.data.offset
      console.log("P:", this.el.object3D.position)
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
      this.mesh.geometry.attributes.normal.needsUpdate = true
    }
    else if (this.data.attribute === 'uv')
    {
      let x = this.el.object3D.position.x / Compositor.el.getAttribute('geometry').width + 0.5
      let y = this.el.object3D.position.y / Compositor.el.getAttribute('geometry').height + 0.5
      for (let v of this.vertices)
      {
        this.mesh.geometry.attributes.uv.setXY(v, x, y)
      }
      this.mesh.geometry.attributes.uv.needsUpdate = true
    }
  }
})

AFRAME.registerComponent('vertex-handles', {
  schema: {
    cloneGeometry: {default: false},
    mergeVertices: {default: true},
    throttle: {default: 5000},
    attribute: {default: 'position'}
  },
  init() {
    this.handles = []
    this.meshes = []
    this.tick = AFRAME.utils.throttleTick(this.tick, this.data.throttle, this)

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
    }
    else if (this.data.attribute === 'uv')
    {
      attr = mesh.geometry.attributes.uv;
      p1 = new THREE.Vector2
      p2 = new THREE.Vector2
      Compositor.el.object3D.getWorldScale(scale);
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

    for (let i = 0; i < attr.count; ++i)
    {
      if ((i + 1) % 100 === 0)
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
        el.setAttribute('vertex-handle', `vertices: ${i}; attribute: ${this.data.attribute}`)
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
  },
  tick(t, dt)
  {
    return;
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
