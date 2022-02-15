import {Util} from './util.js'
import {Pool} from './pool.js'
import {Undo} from './undo.js'
import shortid from 'shortid'
import {STATE_TOGGLED} from './icon-button.js'
import {THREED_MODES} from './layer-modes.js'
import {Layer} from './layer.js'
import {POST_MANIPULATION_PRIORITY} from './manipulator.js'

Util.registerComponentSystem('scene-organizer', {
  init() {
    this.childViews = new Map;
    this.positioner = new THREE.Object3D
    this.el.sceneEl.object3D.add(this.positioner)
  },
  viewFor(what) {
    return this.childViews.get(what.object3D || what)
  },
  launchSceneNode() {
    let el = document.createElement('a-entity')
    this.el.querySelector('#world-root').append(el)
    el.setAttribute('object3d-view', 'target: #canvas-root')
    el.setAttribute('position', '0 1.1 0.2')
    el.setAttribute('scale', '0.05 0.05 0.05')
  },
  launchToolsNode() {
    let el = document.createElement('a-entity')
    this.el.querySelector('#world-root').append(el)
    el.setAttribute('object3d-view', 'target: #activated-tool-root')
    el.setAttribute('position', '0 1.1 0.2')
    el.setAttribute('scale', '0.05 0.05 0.05')
  },
  inspect(what) {
    let view = this.viewFor(what)

    if (!view)
    {
      view = document.createElement('a-entity')
      this.el.querySelector('#world-root').append(view)
      view.setAttribute('object3d-view', {target: (what.object3D || what)})
    }

    view.setAttribute('visible', true)

    Util.whenLoaded(view, () => {
      this.positioner.rotation.set(0, 0, 0)
      this.positioner.position.set(0, 1.1, 0.2)
      this.positioner.scale.set(0.05, 0.05, 0.05)
      Util.positionObject3DAtTarget(view.object3D, this.positioner)
    })

    return view
  }
})

AFRAME.registerComponent('object3d-view', {
  schema: {
    target: {type: 'selector'},
    activeProperty: {default: 'localPosition'},
    parentView: {type: 'selector'},
  },
  events: {
    editfinished: function(e) {
      e.stopPropagation()
      let values = this.getVectorEditors()
      switch (e.target) {
        case this.localPosition.x:
        case this.localPosition.y:
        case this.localPosition.z:
          this.moveTarget(values.x, values.y, values.z)
          break
      }
    },
    originmoved: function(e) {
      e.stopPropagation()
      this.onMoved()
    },
    click: function(e) {
      e.stopPropagation()
      if (e.target.hasAttribute('object3d-view-action'))
      {
        this[e.target.getAttribute('object3d-view-action')](e)
      }
    },
    snappedtoinput: function(e) {
      e.stopPropagation()
      if (!this.haveNodesBeenInitialized) return;
      console.log("Reparenting", this.nameString())
      let snappedto = e.detail.snapped.parentEl;

      this.reparent(snappedto.components['object3d-view'].object)
    },
    dropdownoption: function(e) {
      if (e.target.hasAttribute('data-new-object'))
      {
        e.stopPropagation()
        // e.target.setAttribute('dropdown-button', 'selectedValue', '')
        console.log("Adding new", e.detail)
        if (e.detail === 'object')
        {
          let obj = new THREE.Object3D
          obj.el = this.object.el
          this.object.add(obj)
        }
        else if (e.detail === 'entity' && this.isEl)
        {
          let el = document.createElement('a-entity')
          this.targetEl.append(el)
        }
        else if (e.detail === 'entity' && !this.isEl)
        {
          console.warn("NYI")
        }
      }
    },
    'raycaster-intersected': function(e) {
      if (e.path.indexOf(this.el) > 4) return;
      this.intersectionSet.add(e.target)
      this.toggleBoundsHelper(true)
    },
    'raycaster-intersected-cleared': function(e) {
      if (e.path.indexOf(this.el) > 4) return;
      this.intersectionSet.delete(e.target)
      if (this.intersectionSet.size === 0)
      {
        this.toggleBoundsHelper(false)
      }
    },
  },
  init() {
    Pool.init(this)
    this.system = this.el.sceneEl.systems['scene-organizer']
    let rootId = "view-root-" + shortid.generate()
    this.el.id = rootId
    this.el.innerHTML += require('./partials/object3d-view.html.slm').replace(/view-root/g, rootId)
    this.el.setAttribute('shelf', 'name: Object3D; width: 3; height: 3.5; pinnable: false; closeable: true')
    this.el.classList.add('grab-root')
    this.intersectionSet = new Set();
    this.contents = this.el.querySelector('*[shelf-content]')
    Util.whenLoaded([this.el, this.contents], () => {
      this.localPosition = {
        x: this.el.querySelector('.position.x'),
        y: this.el.querySelector('.position.y'),
        z: this.el.querySelector('.position.z')
      };
      this.globalPosition = {
        x: this.el.querySelector('.position.x'),
        y: this.el.querySelector('.position.y'),
        z: this.el.querySelector('.position.z')
      };
      this.inputNode = this.el.querySelector('a-entity[node-input]')
      this.outputNode = this.el.querySelector('a-entity[node-output]')


      if (this.data.parentView)
      {
        this.generateParentConnection()
      }
      else
      {
        //this.inputNode.setAttribute('visible', false)
        this.haveNodesBeenInitialized = true;
      }

      this.grabber = this.el.querySelector('.grab-redirector')
      this.grabber.setAttribute('grab-redirector', {target: this.isEl ? this.targetEl : this.object, handle: false})
    })
  },
  update(oldData) {
    if (this.data.target.object3D)
    {
      this.isEl = true
      this.targetEl = this.data.target
      this.object = this.targetEl.object3D
    }
    else
    {
      if (this.data.target.el)
      {
        this.targetEl = this.data.target.el
        this.isEl = this.data.target === this.data.target.el.object3D
      }
      else
      {
        this.targetEl = null
        this.isEl = false
      }
      this.object = this.data.target
    }

    Util.whenLoaded(this.el.sceneEl, () => this.system.childViews.set(this.object, this.el))

    Util.whenLoaded(this.targetEl ? [this.el, this.targetEl, this.contents] : [this.el, this.contents], () => {
      this.onMoved()
      this.el.setAttribute('shelf', 'name', this.nameString())
    })
  },
  nameString() {
    if (this.isEl)
    {
      if (this.targetEl.id) return "#" + this.targetEl.id
      if (this.targetEl.hasAttribute('primitive-construct-placeholder')) return "Shape Construct"
      if (this.targetEl.hasAttribute('reference-glb')) return "Reference Object"
      return `${this.targetEl.nodeName.toLowerCase()}[${Object.keys(this.targetEl.components).join(" ")}]`
    }

    return `${this.object.type} ${this.object.name || this.object.uuid}`
  },
  setVectorEditors(editors, vector) {
    editors.x.setAttribute('text', 'value', vector.x.toFixed(3))
    editors.y.setAttribute('text', 'value', vector.y.toFixed(3))
    editors.z.setAttribute('text', 'value', vector.z.toFixed(3))
  },
  getVectorEditors() {
    let vectorReturn = this.pool("vectorReturn", THREE.Vector3);
    vectorReturn.set(
      parseFloat(this.localPosition.x.getAttribute('text').value),
      parseFloat(this.localPosition.y.getAttribute('text').value),
      parseFloat(this.localPosition.z.getAttribute('text').value)
    );
    return vectorReturn;
  },
  loadChildren() {
    // console.log('loading children', this.object.children)
    this.loadedChildren = true
    this.loadedChildrenLength = this.object.children.length
    const zOffset = -0.1
    const scaleDown = 0.75
    const heightOffset = 2.7
    let validChildren = this.object.children.filter(obj => {
      if (obj.userData.vartisteUI) return false;
      return true;
    })
    // if (validChildren.length === this.validChildrenLength) return;
    this.validChildrenLength = validChildren.length
    let existingChildEntities = this.el.getChildEntities()
    for (let i = 0; i < validChildren.length; ++i)
    {
      let obj = validChildren[i]
      if (this.system.childViews.has(obj)) {
        let view = this.system.childViews.get(obj)
        // console.log("Exiting view", obj, view)
        // if (existingChildEntities.indexOf(view) < 0) { this.el.append(view) }
        view.setAttribute('visible', true)
        view.setAttribute('position', `3.3 ${(i - validChildren.length / 2 + 0.5) * heightOffset } ${(i - validChildren.length / 2) * -0.1}`)
        view.setAttribute('scale', `${scaleDown} ${scaleDown} ${scaleDown}`)
        this.connectNodeTo(view)
        continue;
      }

      let view = document.createElement('a-entity')
      console.log("Creating view", obj, view)
      this.el.append(view)
      view.setAttribute('object3d-view', {target: obj, parentView: this.el})
      view.setAttribute('position', `3.3 ${(i - validChildren.length / 2 + 0.5) * heightOffset } ${(i - validChildren.length / 2) * -0.1}`)
      view.setAttribute('scale', `${scaleDown} ${scaleDown} ${scaleDown}`)
    }
  },
  export() {
    this.el.sceneEl.systems['settings-system'].export3dAction(this.object)
  },
  trash() {
    // if (this.isEl) this.targetEl.parentEl.remove(this.targetEl) // ?

    this.object.parent.remove(this.object)
    Util.recursiveDispose(this.object)
    this.el.parentEl.remove(this.el)

    if (!this.haveNodesBeenInitialized) return;
    this.inputNode.components['node-input'].clearSnapped()
  },
  duplicate() {
    if (this.isEl)
    {
      if (this.targetEl.hasAttribute('primitive-construct-placeholder'))
      {
        this.targetEl.components['primitive-construct-placeholder'].makeClone()
      }
      else if (this.targetEl.hasAttribute('reference-glb'))
      {
        this.targetEl.components['reference-glb'].makeClone()
      }
      else
      {
        console.warn("Don't know how to duplicate", this.targetEl)
        let el = document.createElement('a-entity')
        this.targetEl.parentEl.append(el)
        for (let c of Object.keys(this.targetEl.components))
        {
          el.setAttribute(c, this.targetEl.getAttribute(c))
        }
      }
    }
    else
    {
      this.object.parent.add(this.object.clone())
    }
  },

  hide() {
    this.object.visible = !this.object.visible
  },
  applyCompositorMaterialLive() {
    Util.traverseCondition(this.object, o => !o.userData || !o.userData.vartisteUI,  o => {
      if (o.material) o.material = Compositor.material
    })
  },
  applyCompositorMaterialFrozen() {
    let frozen = Compositor.component.frozenMaterial();
    Util.traverseCondition(this.object, o => !o.userData || !o.userData.vartisteUI, o => {
      if (o.material) o.material = frozen
    })
  },
  applySculptingMaterial() {
    let material = this.el.sceneEl.systems['threed-line-system'].getMaterial(1.0)
    Util.traverseCondition(this.object, o => !o.userData || !o.userData.vartisteUI, o => {
      if (o.material) o.material = material
    })
  },
  toggleDoubleSided(e) {
    let doubleSided = e.target.is(STATE_TOGGLED)
    Util.traverseNonUI(this.object, o => {
      if (o.material)
      {
        o.material.side = doubleSided ? THREE.DoubleSide : THREE.FrontSide
      }
    })
  },
  toggleTransparent(e) {
    let transparent = e.target.is(STATE_TOGGLED)
    Util.traverseNonUI(this.object, o => {
      if (o.material)
      {
        o.material.transparent = transparent
      }
    })
  },
  createMaterialPack() {
    this.el.sceneEl.systems['material-pack-system'].addPacksFromObjects(this.object)
  },
  createLayers() {
    Util.traverseNonUI(this.object, o => {
      if (!o.material) return;
      for (let map of ['map'].concat(THREED_MODES))
      {
        if (map === 'envMap') continue;
        if (!o.material[map] || !o.material[map].image) continue;
        let image = o.material[map].image
        let layer = new Layer(image.width, image.height)
        layer.canvas.getContext('2d').drawImage(image, 0, 0)
        if (map !== 'map') {
          layer.mode = map
        }

        Compositor.component.addLayer(Compositor.component.layers.length - 1, {layer})
      }
    })
  },

  keyframe() {
    this.el.sceneEl.systems['animation-3d'].keyframe(this.object)
  },
  deleteAllKeyframes()
  {
    this.el.sceneEl.systems['animation-3d'].clearTrack(this.object)
  },
  shiftKeyframeLeft()
  {
    this.el.sceneEl.systems['animation-3d'].shiftKeyframes(this.object, -1)
  },
  shiftKeyframeRight()
  {
    this.el.sceneEl.systems['animation-3d'].shiftKeyframes(this.object, 1)
  },
  autoRigPose(pose) {
    if (!this.targetEl)
    {
      console.warn("Can't autoRig object3D")
      return
    }

    if (this.targetEl.hasAttribute('ossos-biped-rig'))
    {
      this.targetEl.removeAttribute('ossos-biped-rig')
      return
    }
    this.targetEl.setAttribute('ossos-biped-rig', 'restPoseType', pose)
  },
  autoRigAPose() { this.autoRigPose('A')},
  autoRigTPose() { this.autoRigPose('T')},
  puppeteer(e) {
    if (!this.targetEl) {
      console.warn("Can't puppeteer obj3d yet")
      return
    }

    this.targetEl.setAttribute('animation-3d-keyframed', 'puppeteering', e.target.is('toggled'))
  },
  applyWrapping() {
    let wrap = this.el.sceneEl.systems['animation-3d'].isWrapping(this.object)
    this.object.traverse(o => {
      if (o.el) o.el.setAttribute('animation-3d-keyframed', 'wrapAnimation', wrap)
    })
  },
  toggleBoundsHelper(force = undefined) {
    if (this.boundsHelper)
    {
      if (force === true) return
      this.boundsHelper.parent.remove(this.boundsHelper)
      Util.recursiveDispose(this.boundsHelper)
      this.boundsHelper = null
      return
    }

    if (force === false) return
    this.boundsHelper = new THREE.Box3Helper(Util.recursiveBoundingBox(this.object, {includeUI: false, world: false}))
    this.boundsHelper.userData.vartisteUI = true
    this.object.add(this.boundsHelper)
  },
  axesHelper() {
    if (this.axisHelper)
    {
      this.axisHelper.parent.remove(this.axisHelper)
      Util.recursiveDispose(this.axisHelper)
      this.axisHelper = null
      return
    }
    this.axisHelper = new THREE.AxesHelper()
    this.axisHelper.userData.vartisteUI = true
    this.object.add(this.axisHelper)
  },
  adjustOrigin() {
    if (this.el.hasAttribute('adjustable-origin'))
    {
      this.el.removeAttribute('adjustable-origin')
      return;
    }
    this.el.setAttribute('adjustable-origin', {target: this.isEl ? this.targetEl : this.object})
  },
  applyTransformation() {
    this.object.updateMatrix()

    if (this.object.geometry)
    {
      let geometry = this.object.geometry
      geometry.applyMatrix(this.object.matrix)
      if (geometry.boundsTree) geometry.computeBoundsTree()
      geometry.computeBoundingSphere()
      geometry.computeBoundingBox()
    }

    for (let c of this.object.children)
    {
      Util.applyMatrix(c.matrix.premultiply(this.object.matrix), c)
    }

    Util.applyMatrix(this.object.matrix.identity(), this.object)
    this.onMoved()
  },
  flipNormals() {
    Util.traverseNonUI(this.object, o => {
      if (!o.geometry) return;
      let geometry = o.geometry;
      Util.flipFaceDirection(geometry)
    })
  },
  mergeBufferGeometries() {
    let geometries = []
    Util.traverseCondition(this.object, o => !(o.userData && o.userData.vartisteUI), o => {
      if (!o.geometry) return;
      let geometry = o.geometry.clone()
      for (let attribute in geometry.attributes)
      {
        if (attribute === 'position' || attribute === 'normal' || attribute === 'uv') continue;
        geometry.deleteAttribute(attribute)
      }
      o.updateMatrixWorld()
      geometry.applyMatrix4(o.matrixWorld)
      geometries.push(geometry)
    })
    let merged = THREE.BufferGeometryUtils.mergeBufferGeometries(geometries, false)
    let mesh = new THREE.Mesh(merged, Util.traverseFind(this.object, o => o.material).material)
    merged.computeBoundingBox()
    merged.boundingBox.getCenter(mesh.position)
    merged.center()
    let el = this.el.sceneEl.systems['primitive-constructs'].decompose(mesh)
    // Util.whenLoaded(el, () => Util.positionObject3DAtTarget(el.object3D, this.object))
  },
  mergeBufferGeometriesAndMaterials() {

  },
  resetMatrix() {
    Undo.collect(() => {
      Undo.pushObjectMatrix(this.object)
      this.object.matrix.decompose(this.object.position, this.object.quaternion, this.object.scale)
      Util.callLater(() => this.onMoved())
    })

    Util.applyMatrix(this.object.matrix.identity(), this.object)
    this.onMoved()
  },
  resetAxes(e) {
    let axis = e.target.getAttribute('data-axis')
    console.log("Resseting axis", axis)
    let currentVector = this.getVectorEditors()

    Undo.collect(() => {
      Undo.pushObjectMatrix(this.object)
      this.object.matrix.decompose(this.object.position, this.object.quaternion, this.object.scale)
      Util.callLater(() => this.onMoved())
    })

    switch (this.data.activeProperty)
    {
      case 'localScale':
        currentVector[axis] = 1.0;
        break;
      default:
        currentVector[axis] = 0.0;
        break;
    }
    this.moveTarget(currentVector.x, currentVector.y, currentVector.z)
    this.onMoved()
  },
  reparent(newParent) {
    console.log("Reparenting", this.object, "to parent", newParent)

    // TODO: Need to reparent view el, too
    Util.keepingWorldPosition(this.el.object3D, () => {
      // this.el.parentEl.remove(this.el)
      // this.system.childViews.get(newParent).append(this.el)
      // this.system.childViews.get(newParent).object3D.add(this.el.object3D)
    })

    Util.keepingWorldPosition(this.object, () => {
      newParent.add(this.object)
      if (!this.isEl)
      {
        this.object.el = newParent.el
      }
    })
  },
  connectNodeTo(childView) {
    if (childView.components['object3d-view'].data.parentView !== this.el)
    {
      childView.components['object3d-view'].data.parentView = this.el
      childView.components['object3d-view'].generateParentConnection()
    }
  },
  generateParentConnection() {
    if (this.haveNodesBeenInitialized) return;

    Util.whenLoaded([this.el, this.inputNode, this.outputNode], () => {
      let nodeOutput = this.data.parentView.components['object3d-view'].outputNode.components['node-output'];
      nodeOutput.formConnectionTo(undefined, this.inputNode)
      this.haveNodesBeenInitialized = true
    })
  },

  onDeleted() {
    this.system.childViews.delete(this.object)
    this.el.remove()
  },
  onMoved() {
    switch (this.data.activeProperty)
    {
      case 'localPosition':
        this.setVectorEditors(this.localPosition, this.object.position)
        break;
      case 'globalPosition':
        let worldPos = this.pool('worldPos', THREE.Vector3)
        this.object.getWorldPosition(worldPos)
        this.setVectorEditors(this.globalPosition, worldPos)
        break;
      case 'localScale':
        this.setVectorEditors(this.localPosition, this.object.scale)
        break;
      case 'localRotation':
        let rot = this.pool('rot', THREE.Vector3)
        rot.set(this.object.rotation.x * 180 / Math.PI, this.object.rotation.y * 180 / Math.PI, this.object.rotation.z * 180 / Math.PI)
        this.setVectorEditors(this.localPosition, rot)
        break;
    }
  },
  moveTarget(x, y, z) {
    switch (this.data.activeProperty)
    {
      case 'localPosition':
        this.object.position.set(x,y,z)
        break;
      case 'globalPosition':
        this.object.position.set(x,y,z)
        this.object.parent.worldToLocal(this.object.position)
        break;
      case 'localScale':
        this.object.scale.set(x,y,z)
        break;
      case 'localRotation':
        let rot = this.pool('rot', THREE.Vector3)
        this.object.rotation.set(x * Math.PI / 180, y * Math.PI / 180, z * Math.PI / 180)
      break;
    }
  },

  tick(t, dt) {
    if (this.isEl)
    {
      if (!this.targetEl.parentEl)
      {
        console.log("Lost parent el")
        this.onDeleted()
        return
      }
    }
    else
    {
      if (!this.object.parent)
      {
        console.log("Lost object parent")
        this.onDeleted()
        return;
      }
    }

    if (this.isEl) {
      if (this.targetEl.is('grabbed'))
      {
        this.onMoved()
      }
    }
    else {
      if (this.grabber && this.grabber.components['grab-redirector'].fakeTarget && this.grabber.components['grab-redirector'].fakeTarget.is('grabbed'))
      {
        this.onMoved()
      }
    }

    if (this.loadedChildren && this.loadedChildrenLength !== this.object.children.length)
    {
      this.loadChildren()
    }
  }
})

AFRAME.registerComponent('grab-redirector', {
  schema: {
    target: {type: 'selector'},
    handle: {default: true},
    radius: {default: 0.3},
    resetOnClick: {default: false},
    transferAnimations: {default: true},
  },
  events: {
    click: function(e) {
      if (!this.data.resetOnClick) return;
      if (e.detail.cursorEl && e.detail.cursorEl.id === 'mouse' && e.target === this.globe) return;
      Util.applyMatrix(this.initialMatrix, this.object)
    }
  },
  init() {
    Pool.init(this)
    if (this.data.handle)
    {
      let handle = this.handle = this.el.sceneEl.systems['pencil-tool'].createHandle({radius: this.data.radius, height: this.data.radius * 4, parentEl: this.el})
      handle.setAttribute('position', `0 ${-this.data.radius * 3} 0`)
      handle['redirect-grab'] = this.el
    }

    let globe = this.globe = document.createElement('a-entity')
    this.el.append(globe)
    globe.setAttribute('geometry', `primitive: sphere; radius: ${this.data.radius}; segmentsWidth: 8; segmentsHeight: 8`)
    if (this.el.hasAttribute('grab-redirector-material'))
    {
      globe.setAttribute('material', this.el.getAttribute('grab-redirector-material'))
    }
    else
    {
      globe.setAttribute('material', 'wireframe: true; shader: matcap')
    }
    if (this.el.hasAttribute('globe-material'))
    {
      Util.whenLoaded(globe, () => globe.setAttribute('material', this.el.getAttribute('globe-material')))
    }
    globe.classList.add('clickable')

    this.initialMatrix = new THREE.Matrix4

    this.onObjectKeyframed = this.onObjectKeyframed.bind(this)
  },
  remove()
  {
    // let animation3d = this.el.sceneEl.systems['animation-3d']
    // if (this.data.transferAnimations && animation3d && this.object && this.fakeTarget)
    // {
    //   animation3d.cloneTracks(this.fakeTarget.object3D, this.object)
    //   animation3d.clearTrack(this.fakeTarget.object3D)
    //   let m = Util.matrixFromOneObjectSpaceToAnother(this.fakeTarget.object3D.parent, this.object.parent)
    //   animation3d.applyMatrix(m, this.object)
    // }

    if (this.fakeTarget)
    {
      this.el.sceneEl.systems['manipulator'].removeConstraint(this.fakeTarget, this.fakeConstraint)
      Util.disposeEl(this.fakeTarget)
    }
    this.el.sceneEl.removeEventListener('objectkeyframed', this.onObjectKeyframed)
    Compositor.el.removeEventListener('framechanged', this.onFrameChange)
  },
  update(oldData) {
    if (this.data.target !== oldData.target)
    {
      if (this.data.target.object3D)
      {
        this.globe['redirect-grab'] = this.data.target
        this.object = this.data.target.object3D
      }
      else
      {
        this.object = this.data.target
        if (!this.fakeTarget)
        {
          let fakeTarget = this.fakeTarget = document.createElement('a-entity')
          this.el.sceneEl.append(fakeTarget)
          fakeTarget.setAttribute('flaggable-control', '')
          this.fakeConstraint = this.el.sceneEl.systems['manipulator'].installConstraint(fakeTarget, () => {
            Util.positionObject3DAtTarget(this.object, fakeTarget.object3D)
          }, POST_MANIPULATION_PRIORITY)
          Compositor.el.addEventListener('framechanged', this.onFrameChange)
          Util.whenLoaded(fakeTarget, () => {
            Util.positionObject3DAtTarget(fakeTarget.object3D, this.object)
            if (this.data.transferAnimations) {
              this.fakeTarget.setAttribute('animation-3d-keyframed', 'proxyObject', this.object)
              this.fakeTarget.setAttribute('animation-3d-keyframed', 'enabled', false)
            }
          })
          fakeTarget.addEventListener('stateadded', (e) => {
            if (e.detail === 'grabbed') {
              Util.positionObject3DAtTarget(fakeTarget.object3D, this.object)

              if (this.data.transferAnimations && this.object.el) {
                this.object.el.setAttribute('animation-3d-keyframed', 'enabled', false)
              }
            }
          })
          fakeTarget.addEventListener('stateremoved', e  => {
            if (e.detail === 'grabbed') {
              console.log("Ungrabbed")
              if (this.data.transferAnimations && this.object.el && this.object.el.hasAttribute('animation-3d-keyframed')) {
                console.log("Re-enabling animations")
                this.fakeTarget.setAttribute('animation-3d-keyframed', 'enabled', false)
                this.object.el.setAttribute('animation-3d-keyframed', 'enabled', true)
              }
            }
          })
        }
        this.globe['redirect-grab'] = this.fakeTarget
      }
      this.initialMatrix.copy(this.object.matrix)
    }

    if (this.data.transferAnimations !== oldData.transferAnimations)
    {
      if (this.data.transferAnimations)
      {
        this.el.sceneEl.addEventListener('objectkeyframed', this.onObjectKeyframed)
      }
      else
      {
        this.el.sceneEl.removeEventListener('objectkeyframed', this.onObjectKeyframed)
      }
    }
  },
  onObjectKeyframed(e){
    if (!this.data.transferAnimations) return
    if (!this.fakeTarget) return;
    if (e.detail.object !== this.fakeTarget.object3D) return;
    if (e.detail.deleted) return;
    let animation3d = this.el.sceneEl.systems['animation-3d']
    if (!animation3d) return
    let frameIdx = e.detail.frameIdx
    console.log("Transferring Keyframe")
    // let keyframe = animation3d.matrixTracks.at(this.fakeTarget.object3D, frameIdx)
    // let m = Util.matrixFromOneObjectSpaceToAnother(this.fakeTarget.object3D.parent, this.object.parent)
    // keyframe.premultiply(m)
    animation3d.keyframe(this.object)
    animation3d.deleteKeyframe(this.fakeTarget.object3D, frameIdx)
  },
  onFrameChange(e) {
    if (!this.fakeTarget) return;
    if (this.fakeTarget.is('grabbed')) return;
    Util.positionObject3DAtTarget(this.fakeTarget.object3D, this.object)
  }
})

AFRAME.registerComponent("prop-movement-lever", {
  init() {
    this.el.setAttribute('lever', 'valueRange: 1 -1; handleLength: 0.2')
    this.tick = AFRAME.utils.throttleTick(this.tick, 30, this)
    let el = this.el.parentEl
    while (el)
    {
      if (el.hasAttribute('object3d-view'))
      {
        this.target = el;
        break;
      }
      el = el.parentEl
    }
  },
  tick(t,dt) {
    if (!this.el.components['lever']) return
    if (Math.abs(this.el.components['lever'].value) > 0)
    {
      if (!this.el.components['lever'].grip.is("grabbed")) {
        this.el.components.lever.value = 0;
        this.el.components.lever.setValue(0);
        return;
      }

      let currentValue = parseFloat(this.el.getAttribute('text').value)
      let increment = 0;

      if (this.target.components['object3d-view'].data.activeProperty === 'localRotation')
      {
        increment = 5
      }
      else if (Math.abs(currentValue) < 1)
      {
        increment = Math.abs(currentValue) < 0.1 ? 0.01 : 0.1
      }
      else
      {
        increment = currentValue * 0.1
      }

      currentValue = increment * dt/100.0 * this.el.components.lever.value + currentValue

      this.el.setAttribute('text', 'value', currentValue.toFixed(3))
      this.el.emit('editfinished')
    }
  }
})

function viewTargetEl(object3dview)
{
  return object3dview.grabber.components['grab-redirector'].globe['redirect-grab']
}

AFRAME.registerComponent('organizer-lock-button', {
  dependencies: ['toggle-button'],
  schema: {
    axis: {type: 'string'},
    prop: {default: 'lockedPositionAxes'}
  },
  events: {
    stateadded: function (e) {
      if (e.detail !== STATE_TOGGLED) return;
      let axes = []
      if (viewTargetEl(this.object3dview).hasAttribute('manipulator-lock'))
      {
        axes = viewTargetEl(this.object3dview).components['manipulator-lock'].data[this.data.prop].slice()
      }
      if (axes.indexOf(this.data.axis) < 0)
      {
        axes.push(this.data.axis)
      }
    viewTargetEl(this.object3dview).setAttribute('manipulator-lock', this.data.prop, axes)
    },
    stateremoved: function (e) {
      if (e.detail !== STATE_TOGGLED) return;
      let axes = []
      if (viewTargetEl(this.object3dview).hasAttribute('manipulator-lock'))
      {
        axes = viewTargetEl(this.object3dview).components['manipulator-lock'].data[this.data.prop]
      }
      if (!axes) {
        console.log("No axes", this.data.prop, viewTargetEl(this.object3dview))
      }
      if (axes.indexOf(this.data.axis) >= 0)
      {
        axes.splice(axes.indexOf(this.data.axis), 1)
      }

      viewTargetEl(this.object3dview).setAttribute('manipulator-lock', this.data.prop, axes)
    }
  },
  init() {
    this.object3dview = Util.traverseFindAncestor(this.el, (el) => el.hasAttribute('object3d-view')).components['object3d-view']
  }
})

AFRAME.registerComponent('organizer-grabbable-toggle', {
  dependencies: ['toggle-button'],
  events: {
    stateadded: function (e) {
      if (e.detail !== STATE_TOGGLED) return;
      this.object3dview.targetEl.classList.add('clickable')
    },
    stateremoved: function (e) {
      if (e.detail !== STATE_TOGGLED) return;
      this.object3dview.targetEl.classList.remove('clickable')
    },
  },
  init() {
    this.object3dview = Util.traverseFindAncestor(this.el, (el) => el.hasAttribute('object3d-view')).components['object3d-view']
    Util.whenLoaded(this.el, () => {
      this.el.components['toggle-button'].setToggle(this.object3dview.targetEl.classList.contains('clickable'))
    })
  }
})

AFRAME.registerComponent('organizer-toggle-button', {
  dependencies: ['icon-button'],
  schema: {
    component: {type: 'string'},
    property: {type: 'string'},

    autoSetAttribtue: {default: true},
  },
  init() {
    let object3dview = Util.traverseFindAncestor(this.el, (el) => el.hasAttribute('object3d-view')).components['object3d-view']
    this.targetEl = viewTargetEl(object3dview)
  },
  update(oldData) {
    this.el.setAttribute('visible', !!this.targetEl)
    if (this.targetEl)
    {
      if (!this.targetEl.hasAttribute(this.data.component))
      {
        this.targetEl.setAttribute(this.data.component, '')
      }
      this.el.setAttribute('toggle-button', {target: this.targetEl, component: this.data.component, property: this.data.property})
    }
  }
})

AFRAME.registerComponent('organizer-weight-lever', {
  events: {
    anglechanged: function(e) {
      viewTargetEl(this.object3dview).setAttribute('manipulator-weight', 'weight', Math.sqrt(e.detail.value))
      viewTargetEl(this.object3dview).setAttribute('manipulator-weight', 'type', 'slow')
    }
  },
  init() {
    this.object3dview = Util.traverseFindAncestor(this.el, (el) => el.hasAttribute('object3d-view')).components['object3d-view']
  }
})

AFRAME.registerComponent('organizer-set-target', {
  schema: {
    component: {type: 'string'},
    property: {default: 'target'},
    el: {default: false},
  },
  update(oldData) {
    let object3dview = Util.traverseFindAncestor(this.el, (el) => el.hasAttribute('object3d-view')).components['object3d-view']
    this.el.setAttribute(this.data.component, this.data.property, this.data.el ? object3dview.targetEl : object3dview.data.target)
  }
})

AFRAME.registerComponent('organizer-physics-property', {
  schema: {
    property: {type: 'string'},
    component: {default: 'physx-material'}
  },
  init() {
    let object3dview = this.object3dview = Util.traverseFindAncestor(this.el, (el) => el.hasAttribute('object3d-view')).components['object3d-view']
    if (!object3dview.targetEl) return;

    if (object3dview.targetEl.hasAttribute(this.data.component))
    {
      this.initializeField()
    }
    else
    {
      object3dview.targetEl.addEventListener('componentinitialized', (e) => {
        if (e.detail.name === this.data.component)
        {
          object3dview.targetEl.setAttribute(this.data.component, this.data.property, this.el.getAttribute('text').value)
          this.initializeField()
        }
      })
      console.log("Setting default value", AFRAME.components[this.data.component], this.data.property)
      this.el.setAttribute('text', 'value', AFRAME.components[this.data.component].schema[this.data.property].default.toString())
    }
  },
  initializeField() {
    console.log("Initializing material", this.object3dview.targetEl.getAttribute(this.data.component))
    this.el.setAttribute('edit-field', {target: this.object3dview.targetEl, component: this.data.component, property: this.data.property})
  }
})

AFRAME.registerComponent('organizer-physics-record-button', {
  dependencies: ['organizer-toggle-button'],
  events: {
    click: function(e) {
      if (this.el.is(STATE_TOGGLED))
      {
        this.el.sceneEl.setAttribute('art-physics', {scenePhysics: true})
        Compositor.component.jumpToFrame(0)
        Compositor.component.setIsPlayingAnimation(true)
      }
    }
  }
})

AFRAME.registerComponent('organizer-physics-radio-button', {
  schema: {
    component: {type: 'string'},
    property: {type: 'string'},
    target: {type: 'selector'},
  },
  events: {
    click: function(e) {
      if (!this.el.sceneEl.systems.physx.physXInitialized)
      {
        this.el.sceneEl.setAttribute('art-physics', {scenePhysics: true})
      }
    }
  },
  init() {
    let object3dview = this.object3dview = Util.traverseFindAncestor(this.el, (el) => el.hasAttribute('object3d-view')).components['object3d-view']
    this.data.target = object3dview.targetEl
    this.el.setAttribute('radio-button', this.data)
  }
})

AFRAME.registerComponent('organizer-statistics', {
  events: {
    click: function(e) {
      if (e.target.getAttribute('click-action') === 'refresh')
      {
        e.stopPropagation()
        this.refresh()
      }
    }
  },
  init() {
    this.object3dview = Util.traverseFindAncestor(this.el, (el) => el.hasAttribute('object3d-view')).components['object3d-view']
    this.stats = {
      'Vertices': (o) => {
        let count = 0
        Util.traverseNonUI(o, c => {
          if (c.geometry && c.geometry.attributes.position) count += c.geometry.attributes.position.count
        })
        return count
      },
      'Faces': (o) => {
        let count = 0
        Util.traverseNonUI(o, c => {
          if (c.geometry && c.geometry.index) {
            count += c.geometry.index.count / 3
          }
          else if (c.geometry && c.geometry.attributes.position)
          {
            count += c.geometry.attributes.position.count / 3
          }
        })
        return count
      },
      'Nodes': (o) => {
        let count = 0
        Util.traverseNonUI(o, c => count++)
        return count
      },
      'Materials': (o) => {
        let s = new Set()
        Util.traverseNonUI(o, c => {
          if (c.material) s.add(c.material.uuid)
        })
        return s.size
      }
    }
    Util.whenLoaded(this.el, () => this.refresh())
  },
  refresh() {
    let target = this.el.querySelector('.stats-output')
    for (let el of target.getChildEntities())
    {
      target.remove(el)
    }
    let container = document.createElement('a-entity')
    target.append(container)
    for (let [name, stat] of Object.entries(this.stats))
    {
      let row = document.createElement('a-entity')
      container.append(row)
      row.setAttribute('icon-row', '')
      row.setAttribute('icon-row-text', `${name}: ${stat(this.object3dview.object)}`)
    }
  }
})
