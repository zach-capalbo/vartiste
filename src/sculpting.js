import {Util} from './util.js'
import {Pool} from './pool.js'
import {VectorBrush, StretchBrush, FillBrush} from './brush.js'
import {Layer} from './layer.js'
import {Undo} from './undo.js'
import {ENABLED_MAP, HANDLED_MAPS} from './material-packs.js'
import {ExtrudeGeometry} from './framework/ExtrudeGeometry.js'
import {MarchingSquaresOpt} from './framework/marching-squares.js'
import simplify2d from 'simplify-2d'
import simplify3d from 'simplify-3d'
import {POST_MANIPULATION_PRIORITY} from './manipulator.js'
import {MeshBVH} from './framework/three-mesh-bvh.js';
import {Brush, Evaluator, ADDITION, SUBTRACTION, DIFFERENCE, INTERSECTION} from './framework/three-bvh-csg.js';

window.simplify3d = simplify3d;

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
  dependencies: ['flaggable-control'],
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
    this.el.object3D.userData.vartisteUI = true

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

    let settingUpPromises = []
    let meshes = []

    Util.traverseNonUI(this.el.getObject3D('mesh'), o => {
      if (o.type === 'Mesh' || o.type === 'SkinnedMesh') meshes.push(o)
    })

    for (let mesh of meshes)
    {
      settingUpPromises.push(this.setupMesh(mesh))
    }
    this.allSetUp = Promise.all(settingUpPromises)
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
  async remove() {
    await this.allSetUp;
    for (let el of this.handles)
    {
      el.object3D.parent.remove(el.object3D)
      Util.disposeEl(el)
      // this.el.removeChild(el)
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
    toShape: {default: false},
  },
  events: {
    shapecreated: function(e) {
      if (!this.cutoutStarted) return;

      this.cutoutStarted = false
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
        curveSegments: 3,
        UVGenerator: {
          generateSideWallUV: function ( geometry, vertices, indexA, indexB, indexC, indexD ) {

        		const a_x = vertices[ indexA * 3 ];
        		const a_y = vertices[ indexA * 3 + 1 ];
        		const b_x = vertices[ indexB * 3 ];
        		const b_y = vertices[ indexB * 3 + 1 ];
        		const c_x = vertices[ indexC * 3 ];
        		const c_y = vertices[ indexC * 3 + 1 ];
            const d_x = vertices[ indexD * 3 ];
            const d_y = vertices[ indexD * 3 + 1 ];


        		return [
        			new THREE.Vector2( a_x, a_y ),
        			new THREE.Vector2( b_x, b_y ),
        			new THREE.Vector2( c_x, c_y ),
              new THREE.Vector2( d_x, d_y ),
        		];

        	},
          generateTopUV: function ( geometry, vertices, indexA, indexB, indexC ) {

        		const a_x = vertices[ indexA * 3 ];
        		const a_y = vertices[ indexA * 3 + 1 ];
        		const b_x = vertices[ indexB * 3 ];
        		const b_y = vertices[ indexB * 3 + 1 ];
        		const c_x = vertices[ indexC * 3 ];
        		const c_y = vertices[ indexC * 3 + 1 ];

        		return [
        			new THREE.Vector2( a_x, a_y ),
        			new THREE.Vector2( b_x, b_y ),
        			new THREE.Vector2( c_x, c_y )
        		];

        	},
        }
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
    geometry.center()

    let mesh = new THREE.Mesh(geometry, Compositor.material)

    if (this.data.toShape)
    {
      mesh.material = Compositor.component.frozenMaterial()
      this.el.sceneEl.object3D.add(mesh)
      Compositor.el.object3D.getWorldPosition(mesh.position)
      mesh.geometry.computeBoundingSphere()
      // mesh.position.x -= mesh.geometry.boundingSphere.radius
      // mesh.position.y += mesh.geometry.boundingSphere.radius
      this.el.sceneEl.systems['primitive-constructs'].decompose(mesh)
      // console.log("Adding", mesh)
    }
    else
    {
      // mesh.scale.x = Compositor.component.width / Compositor.el.getAttribute('geometry').width
      // mesh.scale.y = Compositor.component.height / Compositor.el.getAttribute('geometry').height * Compositor.component.height / Compositor.component.width
      this.el.sceneEl.systems['settings-system'].addModelView({scene: mesh}, {replace: true, undo: true})
    }

    if (this.oldBrush)
    {
      this.el.sceneEl.systems['paint-system'].selectBrush(this.oldBrush)
      this.oldBrush = null
    }
  },
  startCutout() {
    this.data.toShape = false
    this.cutoutStarted = true
    this.oldBrush = this.el.sceneEl.systems['paint-system'].brush
    this.el.sceneEl.systems['paint-system'].selectBrush(this.cutBrush)
  },
  startShapeCutout() {
    this.data.toShape = true
    this.cutoutStarted = true
    this.oldBrush = this.el.sceneEl.systems['paint-system'].brush
    this.el.sceneEl.systems['paint-system'].selectBrush(this.cutBrush)
  },
  autoCutShape() {
    if (!this.el.sceneEl.systems['shape-creation'].shapeStarted)
    {
      this.startShapeCutout()
    }
    this.el.sceneEl.systems['shape-creation'].autoTrace({simplify: true})
  },
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

Util.registerComponentSystem('shape-creation', {
  events: {
    shapecreated: function(e) {
      if (!this.shapeStarted) return;

      this.shapeStarted = false
      this.el.sceneEl.systems['paint-system'].selectBrush(this.oldBrush)
      this.handleShape(e.detail)
    }
  },
  init() {
    this.cutBrush = new VectorBrush('vector')
    this.wandShapes = new Map()
  },
  setSolidDrawing() {
    this.el.sceneEl.systems['paint-system'].selectBrush(this.el.systems['brush-system'].brushList.findIndex(b => b.baseid === 'fill1'))
    this.el.sceneEl.systems['paint-system'].selectOpacity(1.0)
  },
  handleShape(shape, {matrix} = {})
  {
    console.log("Creating shape wand", shape)
    let el = document.createElement('a-entity')
    document.querySelector('#world-root').append(el)
    el.setAttribute('scale', '0.7 0.7 0.7')

    shape.autoClose = true

    this.wandShapes.set(el, shape)
    el.setAttribute('threed-line-tool', 'shape: custom')
    Util.whenLoaded(el, () => {
      if (matrix)
      {
        Util.applyMatrix(matrix, el.object3D)
      }
      else
      {
        Util.positionObject3DAtTarget(el.object3D, Compositor.el.object3D, {transformOffset: {x: 0, y: 0, z: 0.3}})
        el.object3D.scale.set(0.3, 0.3, 0.3)
      }
    })
  },
  startShape() {
    this.shapeStarted = true
    this.oldBrush = this.el.sceneEl.systems['paint-system'].brush
    this.el.sceneEl.systems['paint-system'].selectBrush(this.cutBrush)
  },
  autoCutShape() {
    this.startShape()
    this.autoTrace({simplify: true, simplificationFactor: 3})
  },
  autoTrace({simplify = false, canvas, simplificationFactor = 1} = {}) {
    if (!canvas) canvas = Compositor.drawableCanvas
    Undo.pushCanvas(canvas)
    let tmpCanvas = Util.cloneCanvas(canvas)
    let points = MarchingSquaresOpt.getBlobOutlinePoints(canvas, undefined, undefined, 0)
    let simplified = []
    for (let i = 0; i < points.length; i += 2) {
      simplified.push({x: points[i], y: points[i + 1]})
    }

    let brush = this.el.sceneEl.systems['paint-system'].brush
    if (simplify || (brush instanceof StretchBrush))
    {
      simplified = simplify2d(simplified, simplificationFactor)
    }
    let ctx = canvas.getContext('2d')
    let tmpCtx = tmpCanvas.getContext('2d')
    if (brush.startDrawing)
    {
      brush.startDrawing(ctx, points[0], points[1])
    }
    for (let i = 0; i < simplified.length; i ++) {
      brush.drawOutline(tmpCtx, simplified[i].x, simplified[i].y)
      brush.drawTo(ctx, simplified[i].x, simplified[i].y)
    }
    if (brush.endDrawing)
    {
      brush.endDrawing(ctx)
    }

    if (canvas.touch) canvas.touch()
  }
})

Util.registerComponentSystem('threed-line-system', {
  schema: {
    usePressure: {default: true},
    usePaintSystem: {default: false},
    animate: {default: false},
    buildUp: {default: false},
    skeletonize: {default: false},
    roughness: {default: 0.5},
    metalness: {default: 0.0},
  },
  init() {
    this.materialNeedsUpdate = true
    this.filledBrush = new FillBrush('treed-line-filled')
  },
  update(oldData) {
    if (this.data.usePaintSystem !== oldData.usePaintSystem) this.markMaterial()
    if (this.roughness !== oldData.roughness) this.markMaterial()
    if (this.metalness !== oldData.metalness) this.markMaterial()
  },
  markMaterial() {
    this.materialNeedsUpdate = true
  },
  getMaterial(distance) {
    // return new THREE.MeshNormalMaterial()
    let recentColors = document.getElementById('recent-colors')
    if (recentColors && distance > 0) {
      recentColors.components['palette'].addToPalette()
    }

    if (this.material && !this.materialNeedsUpdate) return this.material;
    console.log("Regenerating material")
    if (this.material) {
      let oldMaterial = this.material
      Util.callLater(() => oldMaterial.dispose())
    }
    let brush = this.el.sceneEl.systems['paint-system'].brush;
    let color3 = this.el.sceneEl.systems['paint-system'].color3

    let compositorShader = Compositor.el.getAttribute('material').shader

    if (!this.data.usePaintSystem && this.el.sceneEl.systems['material-pack-system'].activeMaterialMask && compositorShader === 'pbmatcap')
    {
      let previewMaterial = this.el.sceneEl.systems['material-pack-system'].previewMaterial(this.el.sceneEl.systems['material-pack-system'].activeMaterialMask.data.pack)
      this.material = new THREE.MeshPBMatcapMaterial()
      for (let k in this.material.uniforms)
      {
        if (k in previewMaterial)
        {
          this.material.uniforms[k].value = previewMaterial[k]
          this.material[k] = previewMaterial[k]
        }
      }
      console.log("PBMatcap", this.material)
      this.materialNeedsUpdate = false
      this.el.emit('shapematerialupdated', this.material)
      return this.material
    }
    else if (!this.data.usePaintSystem && this.el.sceneEl.systems['material-pack-system'].activeMaterialMask)
    {
      this.material = this.el.sceneEl.systems['material-pack-system'].previewMaterial(this.el.sceneEl.systems['material-pack-system'].activeMaterialMask.data.pack).clone()
      this.material.side = THREE.FrontSide
      this.materialNeedsUpdate = false
      this.el.emit('shapematerialupdated', this.material)
      return this.material
    }
    else if (!this.data.usePaintSystem && compositorShader === 'pbmatcap')
    {
      this.material = new THREE.MeshPBMatcapMaterial()
      this.material.uniforms.color.value.set(color3.r, color3.g, color3.b)
      this.materialNeedsUpdate = false
      this.el.emit('shapematerialupdated', this.material)
      return this.material
    }
    else if (!this.data.usePaintSystem)
    {
      this.material = new THREE.MeshStandardMaterial({
        color: brush.color,
        // envMap: this.el.sceneEl.systems['environment-manager'].envMap,
        // envMapIntensity: this.el.sceneEl.systems['environment-manager'].data.envMapIntensity,
        roughness: this.data.roughness,
        metalness: this.data.metalness
      })
      this.materialNeedsUpdate = false
      this.el.emit('shapematerialupdated', this.material)
      return this.material
    }

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

      if (Util.isLowPower())
      {
        canvas.width = 256
        canvas.height = 64
      }
      else
      {
        canvas.width = 512
        canvas.height = 128
      }

      let ctx = canvas.getContext('2d')

      if (brush.startDrawing)
      {
        brush.startDrawing(ctx, 0, 0.5 * canvas.height)
      }

      let pointCount = brush.connected ? 40 : 10
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
    // texture.encoding = THREE.sRGBEncoding
    texture.generateMipmaps = false
    texture.minFilter = THREE.LinearFilter
    let materialType = THREE.MeshBasicMaterial;

    switch (compositorShader)
    {
      case 'standard': materialType = THREE.MeshStandardMaterial; break;
      case 'matcap': materialType = THREE.MeshMatcapMaterial; break;
      case 'pbmatcap': materialType = THREE.MeshPBMatcapMaterial; break
    }

    if (this.el.sceneEl.systems['material-pack-system'].activeMaterialMask || !this.data.usePaintSystem)
    {
      if (compositorShader === 'pbmatcap')
      {
        materialType = THREE.MeshPBMatcapMaterial
      }
      else
      {
        materialType = THREE.MeshStandardMaterial
      }
    }

    // materialType = THREE.MeshNormalMaterial;

    this.material = new materialType({
      map: texture,
      transparent: transparent,
      depthWrite: !transparent || this.data.shape !== 'line',
      alphaTest: 0.01,
      color: color || new THREE.Color("white"),
      opacity: opacity === undefined ? 1.0 : opacity,
      side: transparent ? THREE.DoubleSide : THREE.FrontSide,
    })

    // console.log("Getting material", transparent, this.material.side === THREE.DoubleSide)

    if (materialType === THREE.MeshStandardMaterial)
    {
      // this.material.envMap = this.el.sceneEl.systems['environment-manager'].envMap,
      // this.material.envMapIntensity = this.el.sceneEl.systems['environment-manager'].data.envMapIntensity
    }
    else if (materialType === THREE.MeshMatcapMaterial)
    {
      this.material.matcap = Compositor.material.matcap
    }

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
        if (map === 'metalnessMap')
        {
          this.material.metalness = 1
        }
        else if (map === 'roughnessMap')
        {
          this.material.roughness = 1
        }
        texture = new THREE.Texture;
        texture.image = maps[map]
        texture.needsUpdate = true
        texture.encoding = map === 'src' ? THREE.sRGBEncoding : THREE.LinearEncoding
        texture.generateMipmaps = false
        texture.minFilter = THREE.LinearFilter
        this.material[map] = texture

        console.log("Set", map)
      }
      this.material.needsUpdate = true

      if (compositorShader === 'pbmatcap')
      {
        for (let k in this.material.uniforms)
        {
          if (k in this.material)
          {
            this.material.uniforms[k].value = this.material[k]
          }
        }
      }
    }

    this.materialNeedsUpdate = false

    this.el.emit('shapematerialupdated', this.material)
    return this.material;
  },
  shapeToBrush(shapeEl, axis="y") {
    let el = document.createElement('a-entity')
    this.el.sceneEl.querySelector('#activated-tool-root').append(el)
    Util.whenLoaded(el, () => {
      Util.positionObject3DAtTarget(el.object3D, shapeEl.object3D, {offset: {x: 0, y: -0.3, z: -0.3}})
      el.object3D.scale.set(0.3, 0.3, 0.3)
      el.setAttribute('threed-line-tool', {shape: 'mesh', mesh: shapeEl, stretchAxis: axis})

    })
  }
})

const FORWARD = new THREE.Vector3(0, 0, 1)
AFRAME.registerComponent('threed-line-tool', {
  dependencies: ['six-dof-tool', 'grab-activate'],
  schema: {
    meshContainer: {type: 'selector', default: '#world-root'},
    switchbackAngle: {default: 80.0},
    moveThreshold: {default: 0.001},
    pointToPoint: {default: false},
    mesh: {default: '#character-base', type: 'selector'},
    stretchAxis: {default: 'y', oneOf: ['x', 'y']},
    shape: {default: 'line', oneOf: ['line', 'square', 'oval', 'circle', 'star', 'heart', 'plank', 'custom', 'mesh', 'edges']},
  },
  events: {
    activate: function(e) {
      Util.callLater(() => {
        this.initialScale = this.el.object3D.scale.x
      })
    },
    triggerdown: function(e) {
      if (!this.data.pointToPoint) return;
      console.log("Trigger down")
      let tipWorld = this.pool('tipWorld', THREE.Vector3)
      this.tipPoint.getWorldPosition(tipWorld)

      for (let i = 0; i < (this.data.shape === 'line' ? 2 : 5); ++i)
      {
        this.points.push({
          x: tipWorld.x,
          y: tipWorld.y,
          z: tipWorld.z,
          fx: 0,
          fy: 0,
          fz: 1,
          scale: this.calcScale(),
          l: 0,
        })
      }

      this.tiggerConstraint = this.el.sceneEl.systems.manipulator.installConstraint(this.el, () => {
        this.tipPoint.getWorldPosition(tipWorld)
        this.tipPoint.getWorldDirection(this.worldForward)
        let scale = this.calcScale()
        let last = this.points.length - 1

        this.points[last].x = tipWorld.x
        this.points[last].y = tipWorld.y
        this.points[last].z = tipWorld.z
        this.points[last].scale = scale

        if (this.pointToPointToPoint)
        {
          this.points[last - 1].x = THREE.Math.lerp(tipWorld.x, this.points[last - 2].x, 0.01)
          this.points[last - 1].y = THREE.Math.lerp(tipWorld.y, this.points[last - 2].y, 0.01)
          this.points[last - 1].z = THREE.Math.lerp(tipWorld.z, this.points[last - 2].z, 0.01)
          this.points[last - 1].scale = scale
          this.points[last - 1].fx = this.worldForward.x
          this.points[last - 1].fy = this.worldForward.y
          this.points[last - 1].fz = this.worldForward.z

          this.points[last].fx = this.worldForward.x
          this.points[last].fy = this.worldForward.y
          this.points[last].fz = this.worldForward.z

          for (let i = 1; i < this.points.length; ++i)
          {
            this.points[i].l = this.points[i - 1].l + Math.sqrt( (this.points[i].x - this.points[i - 1].x) * (this.points[i].x - this.points[i - 1].x) +
                                                                 (this.points[i].y - this.points[i - 1].y) * (this.points[i].y - this.points[i - 1].y) +
                                                                 (this.points[i].z - this.points[i - 1].z) * (this.points[i].z - this.points[i - 1].z))

          }

          this.points[last].l += 0.1

          this.createMesh(this.points)
          return;
        }

        if (this.data.shape === 'mesh')
        {
          this.points[1].x = THREE.Math.lerp(tipWorld.x, this.points[0].x, 0.75)
          this.points[1].y = THREE.Math.lerp(tipWorld.y, this.points[0].y, 0.75)
          this.points[1].z = THREE.Math.lerp(tipWorld.z, this.points[0].z, 0.75)
          this.points[1].l = 0.24
          this.points[1].scale = scale

          this.points[2].x = THREE.Math.lerp(tipWorld.x, this.points[0].x, 0.5)
          this.points[2].y = THREE.Math.lerp(tipWorld.y, this.points[0].y, 0.5)
          this.points[2].z = THREE.Math.lerp(tipWorld.z, this.points[0].z, 0.5)
          this.points[2].l = 0.5
          this.points[2].scale = scale

          this.points[3].x = THREE.Math.lerp(tipWorld.x, this.points[0].x, 0.25)
          this.points[3].y = THREE.Math.lerp(tipWorld.y, this.points[0].y, 0.25)
          this.points[3].z = THREE.Math.lerp(tipWorld.z, this.points[0].z, 0.25)
          this.points[3].l = 0.75
          this.points[3].scale = scale

          this.points[4].l = 1.00
        }
        else if (this.data.shape !== 'line')
        {
          this.points[1].x = THREE.Math.lerp(tipWorld.x, this.points[0].x, 0.99)
          this.points[1].y = THREE.Math.lerp(tipWorld.y, this.points[0].y, 0.99)
          this.points[1].z = THREE.Math.lerp(tipWorld.z, this.points[0].z, 0.99)
          this.points[1].l = 0.1
          this.points[1].scale = scale

          this.points[2].x = THREE.Math.lerp(tipWorld.x, this.points[0].x, 0.5)
          this.points[2].y = THREE.Math.lerp(tipWorld.y, this.points[0].y, 0.5)
          this.points[2].z = THREE.Math.lerp(tipWorld.z, this.points[0].z, 0.5)
          this.points[2].l = 0.5
          this.points[2].scale = scale

          this.points[3].x = THREE.Math.lerp(tipWorld.x, this.points[0].x, 0.01)
          this.points[3].y = THREE.Math.lerp(tipWorld.y, this.points[0].y, 0.01)
          this.points[3].z = THREE.Math.lerp(tipWorld.z, this.points[0].z, 0.01)
          this.points[3].l = 0.9
          this.points[3].scale = scale

          this.points[4].l = 1.00
        }

        for (let i = 0; i < this.points.length; ++i)
        {
          this.points[i].fx = this.worldForward.x
          this.points[i].fy = this.worldForward.y
          this.points[i].fz = this.worldForward.z

        }

        this.createMesh(this.points)
      }, POST_MANIPULATION_PRIORITY)
    },
    triggerup: function(e) {
      if (!this.data.pointToPoint) return;
      console.log("Trigger up")
      this.doneDrawing()
      this.el.sceneEl.systems.manipulator.removeConstraint(this.el, this.tiggerConstraint)
    },
    bbuttondown: function(e) {
      if (this.mesh) {
        if (this.data.pointToPoint)
        {
          this.pointToPointToPoint = true
          this.points.push({
            x: 0,
            y: 0,
            z: 0,
            fx: 0,
            fy: 0,
            fz: 1,
            scale: this.calcScale(),
            l: 0,
          })
          // this.el.sceneEl.systems.manipulator.removeConstraint(this.el, this.tiggerConstraint)
          // this.events.triggerdown.call(this)
        }
        else
        {
          this.doneDrawing()
        }
        return;
      }
      this.el.setAttribute('threed-line-tool', 'pointToPoint', !this.data.pointToPoint)
      console.log("Switching p2p mode", this.data.pointToPoint)
    },
    draw: function(e) {
      if (this.data.pointToPoint) return;
      if (!this.system.material || this.system.materialNeedsUpdate) {
        this.getMaterial()
        return;
      }
      if (!this.endDrawingEl)
      {
        this.endDrawingEl = e.detail.sourceEl;
        this.endDrawingEl.addEventListener('enddrawing', this.doneDrawing)
      }

      let tipWorld = this.pool('tipWorld', THREE.Vector3)
      let worldScale = this.pool('worldScale', THREE.Vector3)
      let worldQuat = this.pool('worldQuat', THREE.Quaternion)
      // let worldUp = this.pool('worldUp', THREE.Vector3)
      // let worldRight = this.pool('worldRight', THREE.Vector3)
      // this.tipPoint.getWorldDirection(this.worldForward)
      this.tipPoint.getWorldPosition(tipWorld)

      this.tipPoint.getWorldQuaternion(worldQuat)
      // worldUp.set(0, 1, 0).applyQuaternion(worldQuat)
      // worldRight.set(1, 0, 0).applyQuaternion(worldQuat)
      this.worldForward.set(0, 0, 1).applyQuaternion(worldQuat)

      let oldVec = this.pool('oldVec', THREE.Vector3)
      let newVec = this.pool('newVec', THREE.Vector3)

      let dist = this.shapeDist;

      if (this.points.length > 0)
      {
        newVec.set(tipWorld.x - this.points[this.points.length - 1].x,
                   tipWorld.y - this.points[this.points.length - 1].y,
                   tipWorld.z - this.points[this.points.length - 1].z)

        dist = this.points[this.points.length - 1].l + newVec.length()

        if (newVec.length < this.data.moveThreshold) return
      }

      if (this.points.length > 3)
      {
        oldVec.set(this.points[this.points.length - 1].x - this.points[this.points.length - 2].x,
                   this.points[this.points.length - 1].y - this.points[this.points.length - 2].y,
                   this.points[this.points.length - 1].z - this.points[this.points.length - 2].z)

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

      let scale = (this.system.data.usePressure ? this.el.sceneEl.systems['pencil-tool-sensitivity'].scaleFunction(1.0 - e.detail.pressure) : 1.0) * this.calcScale()

      // TODO
      if (this.el.hasAttribute('manipulator-weight')) {
        let oldScale = this.points.length > 0 ? this.points[this.points.length - 1].scale : 0;
        let {weight, type} = this.el.getAttribute('manipulator-weight')
        if (type === 'slow') weight = 1.0 - THREE.Math.clamp((1.0 - weight) * this.el.sceneEl.delta / 30, 0, 1)
        scale = THREE.Math.lerp(scale, oldScale, weight);
      }

      this.points.push({
        x: tipWorld.x,
        y: tipWorld.y,
        z: tipWorld.z,
        // rx: worldUp.x,
        // ry: worldUp.y,
        // rz: worldUp.z,
        fx: this.worldForward.x,
        fy: this.worldForward.y,
        fz: this.worldForward.z,
        // tx: worldRight.x,
        // ty: worldRight.y,
        // tz: worldRight.z,
        l: dist,
        scale: scale,
      })
      this.createMesh(this.points)
    },
    stateadded: function(e) {
      if (e.detail === 'grabbed') {
        this.el.sceneEl.systems['pencil-tool'].lastGrabbed = this

        if (this.system.data.animate && Compositor.component.isPlayingAnimation)
        {
          Compositor.component.jumpToFrame(0)
        }

        if (this.el.grabbingManipulator.el.id === 'mouse')
        {
          this.mouseConstraint = this.el.sceneEl.systems.manipulator.installConstraint(this.el, () => {
            let tipWorld = this.pool('tipWorld', THREE.Vector3)
            this.tipPoint.getWorldDirection(this.worldForward)
            this.tipPoint.getWorldPosition(tipWorld)
            let oldPoint = this.pool('oldPoint', THREE.Vector3)
            let dist = this.shapeDist
            if (this.points.length > 0)
            {
              oldPoint.copy(this.points[this.points.length - 1])
              dist = oldPoint.distanceTo(tipWorld)
              if (dist < this.data.moveThreshold) return;
              dist = this.points[this.points.length - 1].l + dist
            }
            let newPoint = {
              x: tipWorld.x,
              y: tipWorld.y,
              z: tipWorld.z,
              fx: this.worldForward.x,
              fy: this.worldForward.y,
              fz: this.worldForward.z,
              l: dist,
              scale: 1
            };
            // if (this.points.length > 3)
            // {
            //   let l = this.points.length
            //   let simplifiedPoints = simplify3d([this.points[l - 2], this.points[l - 1], newPoint], 0.01)
            //   if (simplifiedPoints.length <= 2)
            //   {
            //     console.log("Discarding point")
            //     this.points.pop()
            //   }
            // }
            this.points.push(newPoint)
            this.createMesh(this.points)
          }, POST_MANIPULATION_PRIORITY)
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

        if (this.system.data.animate)
        {
          this.makeReference()
        }
        else
        {
          this.makePrimitives()
        }
      }
    }
  },
  init() {
    this.system = this.el.sceneEl.systems['threed-line-system']
    Pool.init(this, {useSystem: true})
    this.doneDrawing = this.doneDrawing.bind(this)
    this.el.classList.add('grab-root')
    this.handle = this.el.sceneEl.systems['pencil-tool'].createHandle({radius: 0.05, height: 0.5, segments: 8, parentEl: this.el})
    let tipHeight = 0.3

    this.el.setAttribute('action-tooltips', "trigger: Hold to draw; b: Toggle Point-to-point mode")

    this.onFrameChange = this.onFrameChange.bind(this)

    let tip
    if (this.data.shape === 'line' || this.data.shape === 'edges')
    {
      tip = this.tip = this.data.pointToPoint ? document.createElement('a-sphere') : document.createElement('a-cone')
      this.el.append(tip)
      tip.setAttribute('radius-top', 0)
      tip.setAttribute('radius-bottom',  0.05)
      tip.setAttribute('radius',  0.05)
      tip.setAttribute('segments-height', this.data.pointToPoint ? 6 : 2)
      tip.setAttribute('segments-radial', 8)
      tip.setAttribute('height', tipHeight)
      tip.setAttribute('position', `0 ${tipHeight / 2.0} 0`)
      tip.setAttribute('material', 'shader: matcap; src: #asset-shelf')
    }
    else if (this.data.shape === 'mesh')
    {
      this.shapeDist = 0
      tip = this.tip = document.createElement('a-entity')
      this.el.append(tip)
      console.log("Mesh", this.data.mesh)
      Util.whenLoaded([tip, this.data.mesh], () => {
        let mesh = this.data.mesh.getObject3D('mesh').clone()
        tip.setObject3D('mesh', mesh)
        tip.setAttribute('position', `0 ${tipHeight / 2.0} 0`)
        tip.setAttribute('grabbable', '')
        if (this.data.stretchAxis === 'y') {
          tip.setAttribute('rotation', '0 0 90')
        }
        mesh.geometry.computeBoundingSphere()
        let r = mesh.geometry.boundingSphere.radius
        mesh.scale.set(tipHeight / r, tipHeight / r, tipHeight / r)
      })
    }
    else
    {
      tip = document.createElement('a-entity')
      this.el.append(tip)
      let shape = this.getExtrudeShape(true)
      let shapeGeo = new THREE.BufferGeometry().setFromPoints(shape.getPoints());
      let shapeLine = new THREE.Line(shapeGeo, new THREE.LineBasicMaterial({color: 'black'}))
      shapeLine.scale.set(1 , 1, 1)
      shapeLine.position.set(0, tipHeight / 2.0, 0)
      tip.object3D.add(shapeLine)
      console.log("shapeLine", shapeLine)
    }

    let tipPoint = this.tipPoint = new THREE.Object3D();
    tip.object3D.add(tipPoint);
    tipPoint.position.set(0, this.data.pointToPoint ? 0 : tipHeight / 2.0, 0);
    tipPoint.rotation.set(- Math.PI / 2, 0, 0);
    if (this.data.shape === 'mesh' && this.data.stretchAxis === 'y') {
      tipPoint.rotation.set(0, 0, 0);
    }
    this.el.sceneEl.systems['button-caster'].install(['trigger', 'b'])

    this.el.setAttribute('six-dof-tool', 'orientation', new THREE.Vector3(0, 1, 0))

    this.lastFrameSeen = 0;

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
    this.forward2 = new THREE.Vector3


    this.markMaterial = this.system.markMaterial.bind(this.system)

    this.el.sceneEl.addEventListener('colorchanged', this.markMaterial)
    this.el.sceneEl.addEventListener('opacitychanged', this.markMaterial)
    this.el.sceneEl.addEventListener('brushscalechanged', this.markMaterial)
    this.el.sceneEl.addEventListener('brushchanged', this.markMaterial)
    this.el.sceneEl.addEventListener('brushchanged', this.markMaterial)
    this.el.sceneEl.addEventListener('materialmaskactivated', this.markMaterial)
    Compositor.el.addEventListener('componentchanged', this.markMaterial)

    Util.whenLoaded(this.el, () => {
      this.initialScale = this.el.object3D.scale.x
    })

    this.el.scene
  },
  play() {
    Compositor.el.addEventListener('framechanged', this.onFrameChange)
  },
  pause() {
    Compositor.el.removeEventListener('framechanged', this.onFrameChange)
  },
  onFrameChange() {
    let frameIdx = Compositor.component.currentFrame
    const pointDistance = 7
    if (this.mesh && this.system.data.animate && (this.points.length > pointDistance || this.data.pointToPoint) && frameIdx !== this.lastFrameSeen)
    {
      // console.log("Frame", frameIdx, this.mesh.uuid, this.mesh)
      this.el.sceneEl.systems['animation-3d'].visibilityTracks.set(this.mesh, frameIdx - 1, false)
      this.el.sceneEl.systems['animation-3d'].visibilityTracks.set(this.mesh, frameIdx, true)
      if (!this.system.data.buildUp) this.el.sceneEl.systems['animation-3d'].visibilityTracks.set(this.mesh, frameIdx + 1, false)
      if (this.meshes && this.meshes.length > 0)
      {
        this.el.sceneEl.systems['animation-3d'].visibilityTracks.set(this.meshes[this.meshes.length - 1], frameIdx, false)
        this.meshes[this.meshes.length - 1].visible = false
        // console.log("DeFraming mesh", this.meshes[this.meshes.length - 1], frameIdx, this.lastFrameSeen)
        // console.log("Meshes", this.meshes.map(m => m.uuid))
      }

      this.mesh.visible = false


      if (this.data.pointToPoint)
      {
        let points = this.points.slice()
        this.finishMesh()
        this.points.push(...points)
        this.createMesh(this.points)
      }
      else
      {
        let leftoverPoints = []
        for (let i = Math.max(0, this.system.data.buildUp ? 0 : this.points.length - pointDistance); i < this.points.length - 1; ++i)
        {
          if (this.points[i]) leftoverPoints.push(this.points[i])
        }

        this.finishMesh()
        this.points.push(...leftoverPoints)

        if (this.points.length > 0)
        {
          for (let i = this.points.length - 1; i >= 0; --i)
          {
            this.points[i].l = this.points[i].l - this.points[0].l
          }
        }

        this.createMesh(this.points)
      }
      this.lastFrameSeen = frameIdx
    }
    else if (this.system.data.animate && !Compositor.component.isPlayingAnimation)
    {
      for (let mesh of this.meshes)
      {
        this.el.sceneEl.systems['animation-3d'].animate(mesh, {wrapAnimation: false})
      }
    }
  },
  calcScale() {
    return Math.pow(0.8 * this.el.object3D.scale.x / this.initialScale, 1.15)
  },
  createMesh(points, {maxDistance = 100} = {}) {
    if (points.length < 2) return;

    if (this.data.shape === 'mesh')
    {
      return this.stretchMesh(points);
    }
    if (this.data.shape === 'edges')
    {
      return this.edgesMesh(points);
    }
    if (this.data.shape !== 'line')
    {
      return this.extrudeMesh(points);
    }

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
    let forward2 = this.forward2;

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
      forward2.set(points[i+1].fx, points[i+1].fy, points[i+1].fz)
      forward2.multiplyScalar(-1)
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
      this.normals.push(forward2.x, forward2.y, forward2.z)
      this.normals.push(forward.x, forward.y, forward.z)


      // Tri 2
      this.vertexPositions.push(point2.x - direction2.x, point2.y - direction2.y, point2.z - direction2.z)
      this.vertexPositions.push(point1.x + direction.x, point1.y + direction.y, point1.z + direction.z)
      this.vertexPositions.push(point2.x + direction2.x, point2.y + direction2.y, point2.z + direction2.z)

      this.uvs.push(uvEnd, 1,
                    uvStart, 0,
                    uvEnd, 0)

      this.normals.push(forward2.x, forward2.y, forward2.z)
      this.normals.push(forward.x, forward.y, forward.z)
      this.normals.push(forward2.x, forward2.y, forward2.z)

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
    if (material.side !== THREE.DoubleSide) {
      material = material.clone()
      material.side = THREE.DoubleSide
    }

    if (this.mesh)
    {
      this.mesh.parent.remove(this.mesh)
    }

    this.mesh = new THREE.Mesh(this.geometry, material)
    this.data.meshContainer.object3D.add(this.mesh)
    this.mesh.position.copy(this.startPoint)
  },
  getExtrudeShape(initial = false) {
    if (this.shape && this.cachedScale === this.el.object3D.scale.x) return this.shape;

    let sqLength = 0.05 * this.el.object3D.scale.x / 0.7;

    this.cachedScale = this.el.object3D.scale.x;

    this.shapeDist = sqLength * 2

    switch (this.data.shape)
    {
      case 'square':
      {
        const aspect = 1
        this.shape = new THREE.Shape()
          .moveTo( - sqLength * aspect, -sqLength )
          .lineTo( -sqLength * aspect, sqLength )
          .lineTo( -sqLength * aspect, sqLength )
          .lineTo( sqLength * aspect, sqLength )
          .lineTo( sqLength * aspect, sqLength )
          .lineTo( sqLength * aspect, - sqLength )
          .lineTo( sqLength * aspect, - sqLength )
          .lineTo( -sqLength * aspect, -sqLength )
          .lineTo( -sqLength * aspect, -sqLength );
          break;
        }
      case 'oval':
        this.shape = new THREE.Shape()
          .moveTo( 0, 0 )
          .ellipse(0, 0, sqLength, sqLength * 2, Math.PI / 2, 2 * Math.PI + Math.PI / 2)
          break;
      case 'circle':
        this.shape = new THREE.Shape()
          .moveTo( 0, 0 )
          .ellipse(0, 0, sqLength, sqLength, Math.PI / 2, 2 * Math.PI + Math.PI / 2)
        break;
      case 'star': {
        let ir = sqLength * 0.5;
        let numPoints = 5;
        this.shape = new THREE.Shape()
        .moveTo(sqLength, 0);

        for (let a = 0; a < numPoints; ++a)
        {
          let angle = a * Math.PI * 2 / numPoints;
          this.shape.lineTo(Math.cos(angle) * sqLength, Math.sin(angle) * sqLength)
          angle = (a + 0.5) * Math.PI * 2 / numPoints;
          this.shape.lineTo(Math.cos(angle) * ir, Math.sin(angle) * ir)
        }
        this.shape.lineTo(sqLength, 0);
        break;
      }
      case 'heart': {
        let h = 0.6;
        this.shape = new THREE.Shape()
          .moveTo(0, sqLength * h)
					.bezierCurveTo( sqLength * 0.5, sqLength * 1.3, sqLength, sqLength, sqLength, sqLength * h )
          .bezierCurveTo( sqLength, 0, sqLength * 0.1, -sqLength * 0.7, 0, -sqLength)

          .bezierCurveTo( -sqLength * 0.1, -sqLength * 0.7, -sqLength, 0, - sqLength, sqLength * h)
          .bezierCurveTo( -sqLength, sqLength, -sqLength * 0.5, sqLength * 1.3, 0, sqLength * h)
        break;
      }
      case 'plank': {
        const aspect = 0.02
        sqLength = sqLength * 5
        this.shape = new THREE.Shape()
          .moveTo( - sqLength * aspect, -sqLength )
          .lineTo( -sqLength * aspect, sqLength )
          .lineTo( -sqLength * aspect, sqLength )
          .lineTo( sqLength * aspect, sqLength )
          .lineTo( sqLength * aspect, sqLength )
          .lineTo( sqLength * aspect, - sqLength )
          .lineTo( sqLength * aspect, - sqLength )
          .lineTo( -sqLength * aspect, -sqLength )
          .lineTo( -sqLength * aspect, -sqLength );
          break;
      }
      case 'custom': {
        let shape = this.shape = this.el.sceneEl.systems['shape-creation'].wandShapes.get(this.el)
        let box = this.pool('box', THREE.Box2)
        let center = this.pool('center', THREE.Vector2)

        box.makeEmpty()
        for (let curve of shape.curves)
        {
          box.expandByPoint(curve.v1)
          box.expandByPoint(curve.v2)
        }

        if (initial) {
          let size = this.pool('size', THREE.Vector2)
          box.getSize(size)
          this.aspectRatio = size.width / size.height
        }

        box.getCenter(center)

        for (let curve of shape.curves)
        {
          box.getParameter(curve.v1, curve.v1)
          curve.v1.x -= 0.5
          curve.v1.y -= 0.5
          curve.v1.multiplyScalar(sqLength * 4)
          curve.v1.x *= this.aspectRatio
          box.getParameter(curve.v2, curve.v2)
          curve.v2.x -= 0.5
          curve.v2.y -= 0.5
          curve.v2.multiplyScalar(sqLength * 4)
          curve.v2.x *= this.aspectRatio
        }
        break;
      }
    }

    return this.shape;
  },
  edgesMesh(points) {
    this.geometry = new THREE.BufferGeometry().setFromPoints(points);

    let material = new THREE.LineBasicMaterial({color: this.el.sceneEl.systems['paint-system'].color3.getHex()});

    if (this.mesh)
    {
      this.mesh.parent.remove(this.mesh)
      this.mesh.geometry.dispose()
    }

    this.mesh = new THREE.Line(this.geometry, material)
    this.mesh.position.copy(this.startPoint)
    this.data.meshContainer.object3D.add(this.mesh)

    return this.mesh;
  },
  extrudeMesh(points, {maxDistance = 100, useSplineTube = false} = {}) {

    this.startPoint.set(0, 0, 0)
    for (let i = 0; i < points.length; ++i)
    {
      this.startPoint.x += points[i].x
      this.startPoint.y += points[i].y
      this.startPoint.z += points[i].z
    }

    this.startPoint.multiplyScalar(1.0 / points.length)

    let spline;

    if (useSplineTube)
    {
      spline = new THREE.CurvePath();
      for (let p = 0; p < points.length - 1; ++p)
      {
        spline.add(new THREE.LineCurve3(new THREE.Vector3(points[p].x - this.startPoint.x, points[p].y - this.startPoint.y, points[p].z - this.startPoint.z),
                                        new THREE.Vector3(points[p+1].x - this.startPoint.x, points[p+1].y - this.startPoint.y, points[p+1].z - this.startPoint.z)))
      }
    }

    let skeletonize = this.system.data.skeletonize;

    const shape = this.getExtrudeShape()

    let lastLength = points[points.length - 1].l + this.shapeDist

    const extrudeSettings = {
				steps: points.length - 1,
				bevelEnabled: false,
				// extrudePath: spline,
        extrudePath: useSplineTube ? spline : true,
        extrudePts: useSplineTube ? undefined : points,
        centerPoint: this.startPoint,
        enableWeights: skeletonize,
        UVGenerator: {
          generateTopUV: (g, v, a, b, c) => {
            return [
              new THREE.Vector2(0, 0),
              new THREE.Vector2(0, 1),
              new THREE.Vector2(1, 1)
            ]
          },
          generateSideWallUV: (g, v, a, b, c, d, s, sl, ci, cl, clengths) => {
            // console.log("s1, s2", s1, s2)

            // "Stretchable" uvs
            // let mn = s / sl;
            // let mx = (s + 1) / sl;

            // UVs based on segment length
            let mn = s === 0 ? 0.0 : points[s].l / lastLength
            let mx = s === sl - 1 ? 1.0 : points[s + 1].l / lastLength

            if (ci === 0) ci = cl

            let cll = clengths[cl]
            // let yn = clengths[cl - ci] / cll;
            // let yx = clengths[cl - (ci + 1)] / cll;
            let yn = clengths[ci - 1] / cll;
            let yx = clengths[(ci)] / cll;
            // console.log("clengths", ci, cl, cll, yn, yx)
            return [
              new THREE.Vector2(mn, yx),
              new THREE.Vector2(mn, yn),
              new THREE.Vector2(mx, yn),
              new THREE.Vector2(mx, yx),
            ]
          },
          generateTopNormals: () => {
            return [new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 1, 0)]
          },
          generateSideWallNormal: (g, n, a, b, c, d, curve, extrudePts, s, sl, ci, cl) => {
            let normal1 = new THREE.Vector3
            let normal2 = new THREE.Vector3
            let normal3 = new THREE.Vector3
            let normal4 = new THREE.Vector3
            if (this.data.pointToPoint)
            {
              if (s === 0)
              {
                normal1.set(n[0], n[1], n[2])
                return [normal1, normal1, normal1, normal1]
              }
              else if (s === sl - 1) {
                normal1.set(n[n.length - 3], n[n.length - 2], n[n.length - 1])
                return [normal1, normal1, normal1, normal1]
              }
            }
            // normal1.set( - extrudePts[s].fx + n[a * 3 + 0], - extrudePts[s].fy + n[a * 3 + 1], - extrudePts[s].fz + n[a * 3 + 2])
            // normal2.set( - extrudePts[s].fx + n[b * 3 + 0], - extrudePts[s].fy + n[b * 3 + 1], - extrudePts[s].fz + n[b * 3 + 2])
            // normal3.set( - extrudePts[s + 1].fx + n[c * 3 + 0], - extrudePts[s + 1].fy + n[c * 3 + 1], - extrudePts[s + 1].fz + n[c * 3 + 2])
            // normal4.set( - extrudePts[s + 1].fx + n[d * 3 + 0], - extrudePts[s + 1].fy + n[d * 3 + 1], - extrudePts[s + 1].fz + n[d * 3 + 2])

            normal1.set(n[a * 3 + 0], n[a * 3 + 1], n[a * 3 + 2])
            normal2.set(n[b * 3 + 0], n[b * 3 + 1], n[b * 3 + 2])
            normal3.set(n[c * 3 + 0], n[c * 3 + 1], n[c * 3 + 2])
            normal4.set(n[d * 3 + 0], n[d * 3 + 1], n[d * 3 + 2])

            if (normal1.angleTo(normal2) > 0.56)
            {
              normal1.lerp(normal2, 0.5)
              normal2.copy(normal1)
              normal3.lerp(normal4, 0.5)
              normal4.copy(normal3)
            }

            if (false && !this.data.pointToPoint)
            {
              if (s === 0 || s === sl - 1)
              {
                normal1.lerp(normal3, 0.5)
                normal3.copy(normal1)

                normal2.lerp(normal4, 0.5)
                normal4.copy(normal2)
              }
            }

            return [normal1, normal2, normal3, normal4]
          }
        },
			};

    this.geometry = new THREE.BufferGeometry().copy(new ExtrudeGeometry( shape, extrudeSettings ));

    let material = this.getMaterial(1)

    if (this.mesh)
    {
      this.mesh.parent.remove(this.mesh)
      this.mesh.geometry.dispose()
    }

    if (skeletonize)
    {
      // console.log("Geometry", this.geometry, points.length - 1, shape, points)
      material = material.clone()
      material.skinning = true
      this.mesh = new THREE.SkinnedMesh(this.geometry, material)
      let rootBone = new THREE.Bone()
      let cumulativePosition = this.pool('cp', THREE.Vector3)
      cumulativePosition.set(0,0,0)
      let bones = [rootBone]
      for (let p of points)
      {
        let bone = new THREE.Bone()
        let parentBone = bones[bones.length - 1]
        bone.position.copy(p)
        bone.position.sub(this.startPoint)
        bone.position.subVectors(bone.position, cumulativePosition)
        cumulativePosition.add(bone.position)
        bones.push(bone)
        parentBone.add(bone)
      }
      // rootBone.add(this.mesh)
      // this.data.meshContainer.object3D.add(rootBone)
      this.mesh.add(rootBone)
      this.mesh.position.copy(this.startPoint)
      this.data.meshContainer.object3D.add(this.mesh)
      let skeleton = new THREE.Skeleton(bones)
      this.mesh.bind(skeleton)
      console.log("Skeletonized", this.mesh, rootBone)
    }
    else
    {
      this.mesh = new THREE.Mesh(this.geometry, material)
      this.mesh.position.copy(this.startPoint)
      this.data.meshContainer.object3D.add(this.mesh)
    }

  },
  stretchMesh(points) {
    if (!this.baseGeometry)
    {
      this.baseGeometry = this.data.mesh.getObject3D('mesh').geometry.clone()
      this.baseGeometry.computeBoundingBox()
    }

    const mainAxisY = this.data.stretchAxis === 'y'
    const mainAxisX = !mainAxisY

    this.geometry = new THREE.BufferGeometry().copy(this.baseGeometry);

    let attr = this.geometry.attributes.position;
    let baseAttr = this.baseGeometry.attributes.position;
    let normalAttr = this.geometry.attributes.normal;
    let baseNormalAttr = this.geometry.attributes.normal;
    let p = this.pool('p', THREE.Vector3)
    let curvePoint = this.pool('cp', THREE.Vector3)
    let curveNormal = this.pool('cn', THREE.Vector3)

    let tangent = this.pool('tangent', THREE.Vector3)
    let normal = this.pool('normal', THREE.Vector3)
    let binormal = this.pool('binormal', THREE.Vector3)

    let lastLength = points[points.length - 1].l

    this.startPoint.set(0, 0, 0)
    for (let i = 0; i < points.length; ++i)
    {
      this.startPoint.x += points[i].x
      this.startPoint.y += points[i].y
      this.startPoint.z += points[i].z
    }

    this.startPoint.multiplyScalar(1.0 / points.length)

    // let spline = new THREE.CurvePath();
    // for (let p = 0; p < points.length - 1; ++p)
    // {
    //   spline.add(new THREE.LineCurve3(new THREE.Vector3(points[p].x - this.startPoint.x, points[p].y - this.startPoint.y, points[p].z - this.startPoint.z),
    //                                   new THREE.Vector3(points[p+1].x - this.startPoint.x, points[p+1].y - this.startPoint.y, points[p+1].z - this.startPoint.z)))
    // }

    let boxParam = this.pool('boxParam', THREE.Vector3)

    const sqLength = 0.5 * this.el.object3D.scale.x / 0.7;

    function closestPointIndexLessThan(s) {
      for (let i = 1; i < points.length; i++)
      {
        if (points[i].l / lastLength > s) return i - 1
      }
      return points.length - 1;
    }

    let aspect = (this.baseGeometry.boundingBox.max.x - this.baseGeometry.boundingBox.min.x) / (this.baseGeometry.boundingBox.max.z - this.baseGeometry.boundingBox.min.z)
    if (mainAxisX) aspect = (this.baseGeometry.boundingBox.max.y - this.baseGeometry.boundingBox.min.y) / (this.baseGeometry.boundingBox.max.z - this.baseGeometry.boundingBox.min.z)

    for (let i = 0; i < baseAttr.count; ++i)
    {
      p.fromBufferAttribute(baseAttr, i)

      // let s = (p.y - this.baseGeometry.boundingBox.min.y)/(this.baseGeometry.boundingBox.max.y - this.baseGeometry.boundingBox.min.y)
      this.baseGeometry.boundingBox.getParameter(p, boxParam)

      let pct = boxParam.y
      if (mainAxisY)
      {
        boxParam.x -= 0.5
        boxParam.z -= 0.5
        boxParam.x *= aspect
      }
      else
      {
        pct = boxParam.x
        boxParam.y -= 0.5
        boxParam.z -= 0.5
        boxParam.y *= aspect
      }

      let s = closestPointIndexLessThan(pct) + 1
      let curvePoint = points[s - 1]

      if (s < 1 ) s = 1
      if (s > points.length - 1) s = points.length - 1

      let scale = points[s].scale

      // if (s > points.length - 10) {
      //   for (let ii = s; ii >= 0 && i >= s - 10; ii--) {
      //     scale = Math.max(scale, points[ii].scale)
      //   }
      // }

      tangent.subVectors(points[s], points[s - 1]).normalize()
      // tangent.set(points[s].tx, points[s].ty, points[s].tz)
      normal.set(points[s].fx, points[s].fy, points[s].fz)
      binormal.crossVectors(tangent, normal)
      // binormal.set(points[s].rx, points[s].ry, points[s].rz)

      binormal.multiplyScalar((mainAxisY ? boxParam.x : boxParam.z) * scale * sqLength)
      normal.multiplyScalar((mainAxisY ? boxParam.z : boxParam.y) * scale * sqLength)

      p.lerpVectors(points[s - 1], points[s], THREE.Math.mapLinear(pct, points[s - 1].l / lastLength, points[s].l / lastLength, 0, 1)).add(normal).add(binormal)
      attr.setXYZ(i, p.x - this.startPoint.x, p.y - this.startPoint.y, p.z - this.startPoint.z);

      if (normalAttr)
      {
        curveNormal.fromBufferAttribute(baseNormalAttr, i)

        normal.set(points[s-1].fx, points[s-1].fy, points[s-1].fz)
        binormal.crossVectors(tangent, normal)
        binormal.multiplyScalar(mainAxisY ? curveNormal.x : curveNormal.z)
        normal.multiplyScalar(mainAxisY ? curveNormal.z : curveNormal.y)
        normal.add(binormal).normalize()
        normalAttr.setXYZ(i, normal.x, normal.y, normal.z)
      }
    }

    attr.needsUpdate = true
    this.geometry.computeBoundingSphere()
    this.geometry.computeBoundingBox()

    let material = this.getMaterial(1)

    if (this.mesh)
    {
      this.mesh.parent.remove(this.mesh)
      this.mesh.geometry.dispose()
    }

    this.mesh = new THREE.Mesh(this.geometry, material)
    this.mesh.position.copy(this.startPoint)
    this.data.meshContainer.object3D.add(this.mesh)
  },
  finishMesh() {
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

    if (!this.el.sceneEl.systems['primitive-constructs'].data.shareMaterial && this.system.material)
    {
      this.system.material = this.system.material.clone()
    }
  },
  doneDrawing() {
    this.pointToPointToPoint = false
    if (this.endDrawingEl)
    {
      this.endDrawingEl.removeEventListener('enddrawing', this.doneDrawing)
      this.endDrawingEl = null
    }
    if (this.system.data.animate && Compositor.component.isPlayingAnimation)
    {
      if (this.mesh) {
        this.el.sceneEl.systems['animation-3d'].visibilityTracks.set(this.mesh, 0, false)
        this.el.sceneEl.systems['animation-3d'].visibilityTracks.set(this.mesh, Compositor.component.currentFrame, true)
      }
      if (!this.system.data.buildUp) {
        this.el.sceneEl.systems['animation-3d'].visibilityTracks.set(this.mesh, Compositor.component.currentFrame + 1, false)
        this.mesh.visible = false
      }
      if (this.meshes.length > 0)
      {
        this.el.sceneEl.systems['animation-3d'].visibilityTracks.set(this.meshes[this.meshes.length - 1], 0, false)
        this.el.sceneEl.systems['animation-3d'].visibilityTracks.set(this.meshes[this.meshes.length - 1], Compositor.component.currentFrame, false)
      }
    }
    else if (this.system.data.animate)
    {
      if (this.mesh) {
        this.el.sceneEl.systems['animation-3d'].visibilityTracks.set(this.mesh, 0, false)
        this.el.sceneEl.systems['animation-3d'].visibilityTracks.set(this.mesh, Compositor.component.currentFrame, true)
        if (!this.system.data.buildUp) this.el.sceneEl.systems['animation-3d'].visibilityTracks.set(this.mesh, Compositor.component.currentFrame + 1, false)
      }
    }
    this.finishMesh()
    if (this.system.data.animate && this.system.data.buildUp)
    {
      this.meshes.push(new THREE.Mesh())
    }
  },
  getMaterial(...args) {
    return this.system.getMaterial(...args);
  },
  makePrimitives() {
    if (!this.meshes.length) return;

    for (let mesh of this.meshes) {
      this.el.sceneEl.systems['primitive-constructs'].decompose(mesh)
      if (this.system.data.animate) {
        mesh.el.setAttribute('animation-3d-keyframed', `wrapAnimation: ${Compositor.component.isPlayingAnimation}`)

        let animation3d = this.el.sceneEl.systems['animation-3d']
        if (Compositor.component.isPlayingAnimation)
        {
          // if (this.data.buildUp && mesh === this.meshes[this.meshes.length - 1])
          // {
          //
          // }
          animation3d.visibilityTracks.set(mesh, Compositor.component.currentFrame + 1, false)
        }
        else
        {
          // let frameIdx = Compositor.component.currentFrame
          // animation3d.visibilityTracks.set(mesh, frameIdx - 1, false)
          // animation3d.visibilityTracks.set(mesh, frameIdx, true)
          // animation3d.visibilityTracks.set(mesh, frameIdx + 1, false)
        }
      }
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
      let useElEndFrame = Compositor.component.isPlayingAnimation
      if (!Compositor.component.isPlayingAnimation) {
        let framesSize = new Set();
        for (let mesh of meshes)
        {
          if (!this.el.sceneEl.systems['animation-3d'].visibilityTracks.frameIndices[mesh.uuid]) continue;
          for (let i of this.el.sceneEl.systems['animation-3d'].visibilityTracks.frameIndices[mesh.uuid])
          {
            framesSize.add(i)
          }
        }
        console.log("FramesSize", framesSize)
        if (framesSize.size > 3) useElEndFrame = true;
      }
      for (let mesh of meshes)
      {
        if (!mesh.geometry.attributes.position) continue;

        Util.positionObject3DAtTarget(placeholder, mesh)
        mesh.el = el
        targetObj.add(mesh)
        Util.positionObject3DAtTarget(mesh, placeholder)

        if (this.system.data.animate) {
          mesh.el.setAttribute('animation-3d-keyframed', `wrapAnimation: ${useElEndFrame}`)

          if (useElEndFrame)
          {
              this.el.sceneEl.systems['animation-3d'].visibilityTracks.set(mesh, Compositor.component.currentFrame + 1, false)
              this.el.sceneEl.systems['animation-3d'].visibilityTracks.trimTo(mesh, Compositor.component.currentFrame, (x, a, b) => a)
          }
        }
      }
      el.setAttribute('reference-glb', '')
      // el.setAttribute('primitive-construct-placeholder', 'detached: true; manualMesh: true')

    })
  }
})

AFRAME.registerComponent('threed-hull-tool', {
  dependencies: ['six-dof-tool', 'grab-activate'],
  schema: {
    meshContainer: {type: 'selector', default: '#world-root'},
    moveThreshold: {default: 0.001},
    shapeSegments: {default: 24},
    closed: {default: true},
  },
  events: {
    activate: function(e) {
      Util.callLater(() => {
        this.initialScale = this.el.object3D.scale.x
      })
    },
    triggerdown: function(e) {
      this.startLine()
    },
    triggerup: function(e) {
      this.endLine()
    },
    bbuttondown: function(e) {
      if (this.isDrawing) {
        if (!this.pointToPoint)
        {
          this.points = [this.points[0]]
          this.pointToPoint = true
        }
        this.readyForPoint = true
      }
      else
      {
        this.el.setAttribute('threed-hull-tool', 'closed', !this.data.closed)
      }
    },
    stateadded: function(e) {
      if (e.detail === 'grabbed')
      {
        this.el.sceneEl.systems['pencil-tool'].lastGrabbed = this

        this.el.sceneEl.systems.manipulator.installConstraint(this.el, this.onMoved, POST_MANIPULATION_PRIORITY)

        if (this.el.grabbingManipulator.el.id === 'mouse')
        {
          this.grabbedByMouse = true
          this.startLine()
        }
      }
    },
    stateremoved: function(e) {
      if (e.detail === 'grabbed')
      {
        this.el.sceneEl.systems.manipulator.removeConstraint(this.el, this.onMoved)
        if (this.grabbedByMouse)
        {
          this.grabbedByMouse = false
          this.endLine()
        }
        else
        {
          this.finishShape()
        }
      }
    }
  },
  init() {
    this.system = this.el.sceneEl.systems['threed-line-system']
    this.shapes = []
    this.edgeLines = []
    Pool.init(this, {useSystem: true})
    this.el.classList.add('grab-root')
    this.handle = this.el.sceneEl.systems['pencil-tool'].createHandle({radius: 0.05, height: 0.5, segments: 8, parentEl: this.el})
    let tipHeight = 0.3

    this.el.setAttribute('action-tooltips', "trigger: Hold to draw; b: Toggle closed")
    this.onMoved = this.onMoved.bind(this)

    let tip
    tip = this.tip = this.data.pointToPoint ? document.createElement('a-sphere') : document.createElement('a-cone')
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
    if (this.data.shape === 'mesh' && this.data.stretchAxis === 'y') {
      tipPoint.rotation.set(0, 0, 0);
    }
    this.el.sceneEl.systems['button-caster'].install(['trigger', 'b'])

    this.el.setAttribute('six-dof-tool', 'orientation', new THREE.Vector3(0, 0, -1))
  },
  update(oldData) {
  },
  onMoved() {
    let tipWorld = new THREE.Vector3
    this.tipPoint.getWorldPosition(tipWorld)

    if (this.points && this.points.length > 0 && tipWorld.distanceTo(this.points[this.points.length - 1]) < this.data.moveThreshold)
    {
      return;
    }

    if (this.isDrawing)
    {
      if (!this.pointToPoint || this.readyForPoint)
      {
        this.points.push(tipWorld)
        this.readyForPoint = false
      }
      // console.log("Points", this.points)
    }
    else if (this.lastPoint && this.shapes.length > 0)
    {
      this.points = []
      this.points[0] = this.lastPoint
      this.points[1] = tipWorld
    }
    this.createEdgesMesh()
  },
  startLine() {
    this.isDrawing = true
    this.points = []

    if (this.lineMesh)
    {
      this.edgeLines.push(this.lineMesh)
      this.lineMesh = null
    }
  },
  endLine() {
    if (!this.isDrawing) return
    this.isDrawing = false
    this.el.sceneEl.systems.manipulator.removeConstraint(this.el, this.constraint)
    this.constraint = null;
    this.pointToPoint = false

    let oldLastPoint = this.lastPoint

    this.lastPoint = this.points[0]

    let shape = new THREE.CatmullRomCurve3(this.points, this.data.closed);
    let centroid = new THREE.Vector3;
    centroid.set(0,0,0)
    let points = shape.getPoints(13)
    for (let i = 0; i < 12; ++i)
    {
      centroid.add(points[i])
    }
    centroid.multiplyScalar(1.0 / 12)
    shape.centroid = centroid

    const simplificationFactor = 1e-3;
    shape.simplified = simplify2d(this.points, simplificationFactor)

    this.shapes.push(shape)

    let lastLineMesh = this.lineMesh
    console.log("Pushing undo", lastLineMesh, this.edgeLines)

    Undo.push(() => {
      let idx = this.shapes.indexOf(shape)
      if (idx < 0) return;
      this.shapes.splice(idx, 1)
      this.createCylinderMesh()
      this.lastPoint = oldLastPoint
      idx = this.edgeLines.indexOf(lastLineMesh)
      if (idx >= 0) {
        this.edgeLines[idx].parent.remove(this.edgeLines[idx])
        Util.recursiveDispose(this.edgeLines[idx])
        if (idx > 0)
        {
          this.edgeLines[idx - 1].parent.remove(this.edgeLines[idx - 1])
          Util.recursiveDispose(this.edgeLines[idx - 1])
          this.edgeLines.splice(idx - 1, 2)
        }
        else
        {
          this.edgeLines.splice(idx , 1)
        }
      }
    })

    this.edgeLines.push(this.lineMesh)
    this.lineMesh = null

    console.log("Shapes", this.shapes)
    this.createCylinderMesh()
  },
  finishShape() {
    if (!this.mesh) return;

    let center = this.pool('center', THREE.Vector3)
    this.geometry.computeBoundingBox()
    this.geometry.boundingBox.getCenter(this.mesh.position)
    this.geometry.center()
    if (this.mesh.skeleton)
    {
      this.mesh.skeleton.bones[1].position.sub(this.mesh.position)
      this.mesh.bind(this.mesh.skeleton)
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
    })

    this.el.sceneEl.systems['primitive-constructs'].decompose(this.mesh)
    this.mesh = null
    this.shapes = []

    if (this.lineMesh)
    {
      this.lineMesh.parent.remove(this.lineMesh)
      this.lineMesh.geometry.dispose()
      this.lineMesh = null
    }

    for (let mesh of this.edgeLines)
    {
      mesh.parent.remove(mesh)
      mesh.geometry.dispose()
    }
    this.edgeLines = []

    this.lastPoint = null
    this.points = []
  },
  createEdgesMesh() {
    if (!this.points || this.points.length < 2) return
    let geometry = new THREE.BufferGeometry().setFromPoints(this.data.closed ? [this.points[this.points.length - 1]].concat(this.points) : this.points);

    let lineColors = []
    let start = this.pool('start', THREE.Color)
    start.setRGB(0, 1, 0)
    let end = this.pool('end', THREE.Color)
    end.setRGB(1, 0, 0)
    let c = this.pool('c', THREE.Color);
    if (this.data.closed) { lineColors.push(end.r, end.g, end.b); }
    for (let i = 0; i < this.points.length; ++i)
    {
      c.lerpColors(start, end, i / this.points.length)
      lineColors.push(c.r, c.g, c.b)
    }
    let colorAttr = new THREE.Float32BufferAttribute(lineColors, 3)

    geometry.setAttribute('color', colorAttr)
    let material = new THREE.LineBasicMaterial({color: 'white', vertexColors: THREE.VertexColors});
    // let material = new THREE.LineBasicMaterial({color: this.el.sceneEl.systems['paint-system'].color3.getHex()});
    if (this.lineMesh)
    {
      this.lineMesh.parent.remove(this.lineMesh)
      this.lineMesh.geometry.dispose()
    }

    this.lineMesh = new THREE.Line(geometry, material)
    // this.mesh.position.copy(this.startPoint)
    this.data.meshContainer.object3D.add(this.lineMesh)
  },
  createCylinderMesh() {
    let shapes = this.shapes;
    if (shapes.length < 1) return;
    const n = this.shapes.length - 1

    if (this.data.closed)
    {
      shapes = [new THREE.CatmullRomCurve3([this.shapes[0].centroid,this.shapes[0].centroid,this.shapes[0].centroid,this.shapes[0].centroid], true)].concat(this.shapes)
      shapes.push(new THREE.CatmullRomCurve3([this.shapes[n].centroid,this.shapes[n].centroid,this.shapes[n].centroid,this.shapes[n].centroid], true))
    }
    else
    {
      shapes = this.shapes
    }
    const heightSegments = shapes.length - 1;
    const radialSegments = THREE.Math.clamp(Math.max.apply(null, this.shapes.map(s => s.simplified.length)), this.data.shapeSegments, this.data.shapeSegments * 10)

    this.geometry = new THREE.BufferGeometry;

		const indices = [];
		const vertices = [];
		const normals = [];
		const uvs = [];
    const boneIndexArray = [];
    const boneWeightsArray = [];

		// helper variables

    const radiusTop = 1.0;
    const radiusBottom = 1.0;
    const thetaLength = 2 * Math.PI;
    const thetaStart = 0;
    const height = 1.0;

		let index = 0;
		const indexArray = [];
		const halfHeight = height / 2;
		let groupStart = 0;

		// generate geometry
		generateTorso.call(this);

    let geometry = this.geometry;

		// build geometry
		this.geometry.setIndex( indices );
		this.geometry.setAttribute( 'position', new THREE.Float32BufferAttribute( vertices, 3 ) );
		this.geometry.setAttribute( 'normal', new THREE.Float32BufferAttribute( normals, 3 ) );
		this.geometry.setAttribute( 'uv', new THREE.Float32BufferAttribute( uvs, 2 ) );

    if (this.system.data.skeletonize)
    {
      this.geometry.setAttribute( 'skinIndex', new THREE.Uint8BufferAttribute( boneIndexArray, 4))
      this.geometry.setAttribute( 'skinWeight', new THREE.Float32BufferAttribute( boneWeightsArray, 4));
    }

    this.geometry.computeVertexNormals()


    if (this.data.closed)
    {
      let normal = this.pool('normal', THREE.Vector3)
      let normal2 = this.pool('normal', THREE.Vector3)
      let normalAttr = this.geometry.attributes.normal
      for (let y = 0; y < heightSegments; ++y)
      {
        let i = y * (radialSegments + 1)
        let ii = (y + 1) * (radialSegments + 1) - 1
        normal.fromBufferAttribute(normalAttr, i)
        normal2.fromBufferAttribute(normalAttr, ii)
        normal.lerp(normal2, 0.5)
        // normal.set(0,0,0)
        normalAttr.setXYZ(i, normal.x, normal.y, normal.z)
        normalAttr.setXYZ(ii, normal.x, normal.y, normal.z)
      }
      normalAttr.needsUpdate = true
    }

    if (this.mesh)
    {
      this.mesh.parent.remove(this.mesh)
      this.mesh.geometry.dispose()
    }

    let material = this.system.getMaterial(1.0)
    if (!this.data.closed && material.side !== THREE.DoubleSide) {
      material = material.clone()
      material.side = THREE.DoubleSide
    }

    if (this.system.data.skeletonize)
    {
      material = material.clone()
      material.skinning = true;
    }

    // const bvh = geometry.computeBoundsTree();
    let raycaster = this.pool('raycaster', THREE.Raycaster)
    raycaster.ray.direction.set(0, 0, 1);
    raycaster.ray.origin.copy(this.shapes[Math.floor(this.shapes.length / 2)].centroid)
    const hit = raycaster.intersectObject(new THREE.Mesh(geometry))
    if (hit.length % 2 === 1)
    {
      console.log("Got odd hits. Flipping face direction")
      Util.flipFaceDirection(geometry)
    }
    console.log("Hull hit", raycaster, hit)

    if (this.system.data.skeletonize)
    {
      this.mesh = new THREE.SkinnedMesh(this.geometry, material)
      let rootBone = new THREE.Bone()
      let cumulativePosition = this.pool('cp', THREE.Vector3)
      cumulativePosition.set(0,0,0)
      let bones = [rootBone]
      for (let p of shapes)
      {
        if (!p.centroid) continue;

        console.log("Checking shape", p)
        let bone = new THREE.Bone()
        let parentBone = bones[bones.length - 1]
        bone.position.copy(p.centroid)
        // bone.position.sub(this.startPoint)
        bone.position.subVectors(bone.position, cumulativePosition)
        cumulativePosition.add(bone.position)
        bones.push(bone)
        parentBone.add(bone)
      }
      // rootBone.add(this.mesh)
      // this.data.meshContainer.object3D.add(rootBone)
      this.mesh.add(rootBone)
      // this.mesh.position.copy(this.startPoint)
      this.data.meshContainer.object3D.add(this.mesh)
      let skeleton = new THREE.Skeleton(bones)
      this.mesh.bind(skeleton)
      console.log("Skeletonized", this.mesh, rootBone)
    }
    else
    {
      this.mesh = new THREE.Mesh(this.geometry, material)
      this.data.meshContainer.object3D.add(this.mesh)
    }

    console.log("Generated", this.mesh)

		function generateTorso()  {
			const normal = this.pool('normal', THREE.Vector3);
			const vertex = this.pool('vertext', THREE.Vector3);

			let groupCount = 0;

			// this will be used to calculate the normal
			const slope = 0.0 //( radiusBottom - radiusTop ) / height;

			// generate vertices, normals and uvs
      let totalHeightLengths = []
      for ( let y = 0; y <= heightSegments; y ++ ) {
        if (true || !shapes[y].segmentedPoints)
        {
          shapes[y].segmentedPoints = shapes[y].getSpacedPoints(radialSegments);
          shapes[y].segmentedLengths = [0]
          for (let i = 1; i <= radialSegments; ++i)
          {
            shapes[y].segmentedLengths.push(shapes[y].segmentedLengths[i - 1] + shapes[y].segmentedPoints[i].distanceTo(shapes[y].segmentedPoints[i - 1]))
          }
        }

        for ( let x = 0; x <= radialSegments; x ++ ) {
          if (y === 0) {
            totalHeightLengths[x] = 0
            continue;
          }

          totalHeightLengths[x] += shapes[y].segmentedPoints[x].distanceTo(shapes[y - 1].segmentedPoints[x])
        }
      }

      let currentHeightLengths = []

			for ( let y = 0; y <= heightSegments; y ++ ) {
				const indexRow = [];
				const v = y / heightSegments;

				// calculate the radius of the current row
				const radius = v * ( radiusBottom - radiusTop ) + radiusTop;
        const points = shapes[y].segmentedPoints
        // const lengths = shapes[y].getLengths(radialSegments)
        const shapeLength = shapes[y].getLength()
        const lengths = shapes[y].segmentedLengths

				for ( let x = 0; x <= radialSegments; x ++ ) {
					const u = x / radialSegments;
					const theta = u * thetaLength + thetaStart;

					const sinTheta = Math.sin( theta );
					const cosTheta = Math.cos( theta );

					// vertex
          vertex.copy(points[x])
					vertices.push( vertex.x, vertex.y, vertex.z );
					// normal
					normal.set( sinTheta, slope, cosTheta ).normalize();
					normals.push( normal.x, normal.y, normal.z );

          if (this.system.data.skeletonize)
          {
            if (this.data.closed)
            {
              boneIndexArray.push(Math.min(y, shapes.length - 2), 0, 0, 0);
            }
            else
            {
              boneIndexArray.push(THREE.Math.clamp(y + 1, 0, shapes.length), 0, 0, 0);
            }
            boneWeightsArray.push(  1, 0, 0, 0);
          }


          if ( y === 0)
          {
            currentHeightLengths[x] = 0
          }
          else
          {
            currentHeightLengths[x] += shapes[y].segmentedPoints[x].distanceTo(shapes[y - 1].segmentedPoints[x])
          }
          let heightT = totalHeightLengths[x] < 0.0001 ? 1 - v : currentHeightLengths[x] / totalHeightLengths[x]

					// uv
					uvs.push( heightT, shapeLength < 0.0001 ? u : lengths[x] / shapeLength );
					// save index of vertex in respective row
					indexRow.push( index ++ );
				}

				// now save vertices of the row in our index array
				indexArray.push( indexRow );
			}

			// generate indices
			for ( let x = 0; x < radialSegments; x ++ ) {
				for ( let y = 0; y < heightSegments; y ++ ) {
					// we use the index array to access the correct indices
					const a = indexArray[ y ][ x ];
					const b = indexArray[ y + 1 ][ x ];
					const c = indexArray[ y + 1 ][ x + 1 ];
					const d = indexArray[ y ][ x + 1 ];

					// faces
					indices.push( a, b, d );
					indices.push( b, c, d );

					// update group counter
					groupCount += 6;
				}
			}
			// calculate new start value for groups
			groupStart += groupCount;

		};
  }
})

const CSG_TOOL_OPERATION_MAP = {ADDITION, SUBTRACTION, DIFFERENCE, INTERSECTION}
const CSG_TOOL_OPERATION_ARRAY = Object.keys(CSG_TOOL_OPERATION_MAP)
AFRAME.registerComponent('csg-tool', {
  dependencies: ['six-dof-tool', 'grab-activate', 'grab-root'],
  schema: {
    operation: {default: 'SUBTRACTION', oneOf: CSG_TOOL_OPERATION_ARRAY},
    repeatInterval: {default: 50},
    repeatWait: {default: 300},
  },
  events: {
    startobjectconstraint: function(e) {
      let el = e.detail.el
      el.addEventListener('click', this.runCSG)
      el.addEventListener('triggerdown', this.events.triggerdown)
      el.addEventListener('triggerup', this.events.triggerup)
      if (e.target === this.flagA)
      {
        this.elA = el
        this.csgEvaluator = new Evaluator()
        let mesh = el.getObject3D('mesh')
        this.brush1 = mesh.isBrush ? mesh : this.brushify(mesh)
      }
      else
      {
        this.elB = el
        this.brush2 = this.brushify(el.getObject3D('mesh'))
      }

      if (this.elA && this.elB)
      {
        // let positioner = this.pool('positioner', THREE.Object3D)
        // let parent = this.elA.getObject3D('mesh').parent
        // parent.add(positioner)
        // Util.positionObject3DAtTarget(positioner, this.elB.getObject3D('mesh'))
        // Util.applyMatrix(positioner.matrixWorld, this.brush2)
        // this.brush1.matrixWorld.copy(this.elA.getObject3D('mesh').matrixWorld)
        // console.log("Trying to position boolean", this.brush1, this.brush2, this.elA.getObject3D('mesh'), this.elB.getObject3D('mesh'), positioner)
        // parent.remove(positioner)
      }

      console.log("CSG Selection", this.elA, this.elB)
    },
    endobjectconstraint: function(e) {
      e.detail.el.removeEventListener('click', this.runCSG)
      e.detail.el.removeEventListener('triggerdown', this.events.triggerdown)
      e.detail.el.removeEventListener('triggerup', this.events.triggerup)
      if (e.target === this.flagA)
      {
        this.elA = null
      }
      else
      {
        this.elB = null
      }
    },
    click: function(e) {
      this.runCSG()
    },
    bbuttondown: function(e) {
      console.log("Switching operation to", CSG_TOOL_OPERATION_ARRAY[(CSG_TOOL_OPERATION_ARRAY.indexOf(this.data.operation) + 1) % CSG_TOOL_OPERATION_ARRAY.length])
      this.el.setAttribute('csg-tool', 'operation', CSG_TOOL_OPERATION_ARRAY[(CSG_TOOL_OPERATION_ARRAY.indexOf(this.data.operation) + 1) % CSG_TOOL_OPERATION_ARRAY.length])
    },
    triggerdown: function(e) {
      console.log("Starting triggerdown", this, this.el)
      this.startPressed = this.el.sceneEl.time
    },
    triggerup: function(e) {
      this.startPressed = undefined
    }
  },
  init() {
    Pool.init(this)
    this.el.sceneEl.systems['button-caster'].install(['trigger', 'b'])
    let handle = this.handle = this.el.sceneEl.systems['pencil-tool'].createHandle({radius: 0.07, height: 0.3, parentEl: this.el})
    let flagA = this.flagA = this.el.sceneEl.systems['pencil-tool'].createConnectedFlag(this.el, {connectorName: 'flagA'})
    flagA.setAttribute('decorator-flag', 'color', '#CB3B4E')
    flagA.setAttribute('preactivate-tooltip', 'Operation Target (Mesh A)')
    Util.whenLoaded(flagA, () => flagA.object3D.position.x *= -1)
    let flagB = this.flagB = this.el.sceneEl.systems['pencil-tool'].createConnectedFlag(this.el, {connectorName: 'flagB'})
    flagB.setAttribute('preactivate-tooltip', 'Operand (Mesh B)')

    this.el.setAttribute('action-tooltips', 'b: Switch Operation; click: Evaulate Boolean')

    this.runCSG = this.runCSG.bind(this)
    this.tick = AFRAME.utils.throttleTick(this.tick, 10, this)
  },
  update(oldData)
  {
    this.el.setAttribute('action-tooltips', `label: Boolean (${this.data.operation})`)
  },
  brushify(mesh){
    let brush = new Brush(mesh.geometry, mesh.material);
    // mesh.updateMatrixWorld()
    // Util.applyMatrix(mesh.matrixWorld, brush)
    // brush.matrixWorld.copy(mesh.matrixWorld)
    return brush
  },
  runCSG({enableUndo = true} = {}) {
    if (!this.elA || !this.elB)
    {
      console.log("Cannot CSG without elA and elB", this.elA, this.elB)
      return
    }

    const csgEvaluator = this.csgEvaluator;
    // csgEvaluator.debug.enabled = true
    let meshA = this.elA.getObject3D('mesh')
    let meshB = this.elB.getObject3D('mesh')

    csgEvaluator.useGroups = meshA.material !== meshB.material;
    let originalMatrix = this.pool('originalMatrix', THREE.Matrix4)
    const brush1 = this.brush1
    const brush2 = this.brush2

    let originalBrushMatrix = this.pool('originalBrushMatrix', THREE.Matrix4)

    meshA.updateMatrixWorld()
    originalMatrix.copy(meshA.matrixWorld)
    originalBrushMatrix.copy(brush1.matrix)

    let originalBrushParent = brush1.parent
    if (originalBrushParent)
    {
      originalBrushParent.remove(brush1)
    }

    brush1.matrixWorld.identity()
    brush2.matrixWorld.identity()
    Util.applyMatrix(originalMatrix, brush1)
    Util.applyMatrix(meshB.matrixWorld, brush2)
    brush1.matrixWorld.copy(originalMatrix)
    brush2.matrixWorld.copy(meshB.matrixWorld)

    const result = csgEvaluator.evaluate( brush1, brush2, CSG_TOOL_OPERATION_MAP[this.data.operation]);

    if (originalBrushParent)
    {
      originalBrushParent.add(brush1)
    }

    meshA.parent.add(result)
    meshA.geometry.dispose()

    if (enableUndo)
    {
      Undo.pushSymmetric((u) => {
        this.elA.setObject3D('mesh', result)
        u.push(() => {
          this.elA.setObject3D('mesh', meshA)
        })
      })
    }
    else
    {
      this.elA.setObject3D('mesh', result)
    }

    // console.log("result", result.matrix.elements.slice())
    result.matrix.copy(originalBrushMatrix)
    originalMatrix.invert()
    result.matrix.multiply(originalMatrix)
    Util.applyMatrix(result.matrix, result)

    result.geometry.computeBoundingBox()
    result.geometry.computeBoundingSphere()
    result.geometry.computeBoundsTree()
    result.updateMatrixWorld()

    // window.csgEvaluator = csgEvaluator
    // window.csgResult = result
    // console.log("Eval", result, csgEvaluator)

    this.brush1 = result

    if (!csgEvaluator.useGroups)
    {
      result.material = meshA.material
    }

    for (let group of result.geometry.groups)
    {
      if (group.materialIndex === undefined)
      {
        group.materialIndex = 0
      }
    }
  },
  tick(t,dt) {
    if (this.startPressed && t - this.data.repeatWait > this.startPressed)
    {
      this.runCSG({enableUndo: false})
      this.startPressed += this.data.repeatInterval
    }
  }
})
