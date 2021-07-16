import {Util} from './util.js'
import {Pool} from './pool.js'


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
