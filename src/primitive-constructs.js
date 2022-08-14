import {Util} from './util.js'
import {Layer} from './layer.js'
import {Undo} from './undo.js'
import {Pool} from './pool.js'
import {HANDLED_MAPS} from './material-packs.js'
import './extra-geometries.js'

Util.registerComponentSystem('primitive-constructs', {
  schema: {
    container: {type: 'selector', default: '#shape-root'},
    shareMaterial: {default: false},
  },
  init() {
    Pool.init(this)
    this.placeholder = new THREE.Object3D
    this.el.sceneEl.object3D.add(this.placeholder)
  },
  grabConstruct(el) {
    if (el === this.lastGrabbed) return;

    if (this.lastGrabbed)
    {
      if (this.lastGrabbed.hasAttribute('vertex-handles'))
      {
        this.lastGrabbed.getObject3D('mesh').geometry.computeBoundsTree()
      }
      this.lastGrabbed.removeAttribute('vertex-handles')
      this.lastGrabbed.removeAttribute('frame')
    }
    this.lastGrabbed = el

    if (!el) return;

    el.setAttribute('frame', 'pinnable: false; outline: false; useBounds: true')
    Util.whenComponentInitialized(el, 'frame', () => {
      let button = el.components.frame.addButton('#asset-dots-square')
      button.setAttribute('tooltip', 'Edit Vertices')
      button.addEventListener('click', () => {
        el.setAttribute('vertex-handles', '')
        el.removeAttribute('axis-handles')
        el.removeAttribute('frame')
      })

      button = el.components.frame.addButton('#asset-newspaper-variant-outline')
      button.setAttribute('tooltip', 'Scene Organizer')
      button.addEventListener('click', () => {
        console.log("Inspecting", el)
        this.el.sceneEl.systems['scene-organizer'].inspect(el)
      })

      button = el.components.frame.addButton('#asset-swap-vertical-variant')
      button.setAttribute('tooltip', 'Create Height Stretch Wand')
      button.addEventListener('click', () => {
        this.el.sceneEl.systems['threed-line-system'].shapeToBrush(el, 'y')
      })

      button = el.components.frame.addButton('#asset-swap-horizontal-variant')
      button.setAttribute('tooltip', 'Create Width Stretch Wand')
      button.addEventListener('click', () => {
        this.el.sceneEl.systems['threed-line-system'].shapeToBrush(el, 'x')
      })

      this.el.sceneEl.emit('refreshobjects')
    })
  },
  decompose(mesh) {
    let placeholder = this.placeholder
    let el = document.createElement('a-entity')
    this.data.container.append(el)
    el.classList.add('clickable')
    mesh.el = el
    Util.positionObject3DAtTarget(placeholder, mesh)
    el.object3D.add(mesh)
    el.setObject3D('mesh', mesh)
    Util.positionObject3DAtTarget(mesh, placeholder)
    // el.object3D.position.copy(mesh.position)
    let invMat = this.pool('invMat', THREE.Matrix4)
    invMat.copy(this.data.container.object3D.matrixWorld)
    invMat.invert()
    mesh.matrix.premultiply(invMat)
    Util.applyMatrix(mesh.matrix, el.object3D)
    Util.applyMatrix(mesh.matrix.identity(), mesh)

    // mesh.position.set(0, 0, 0)

    el.setAttribute('primitive-construct-placeholder', 'manualMesh: true; detached: true;')
    return el
  },
  decomposeReferences(els) {
    let meshes = []

    if (!els) els = document.querySelectorAll('.reference-glb');


    els.forEach(refEl => {
      meshes.length = 0
      Util.traverseFindAll(refEl.getObject3D('mesh'), (m) => m.type === 'Mesh', {outputArray: meshes})

      for (let mesh of meshes)
      {
        this.decompose(mesh)
      }

      refEl.remove()
    })
  },
  decomposeCompositor() {
    let frozenMaterial = Compositor.component.frozenMaterial()
    if (Compositor.nonCanvasMeshes.length === 0)
    {
      let mesh = Compositor.mesh.clone()
      mesh.material = frozenMaterial
      this.data.container.object3D.add(mesh)
      Util.positionObject3DAtTarget(mesh, Compositor.mesh)
      this.decompose(mesh)
      return;
    }
    for (let mesh of Compositor.nonCanvasMeshes)
    {
      mesh.material = frozenMaterial
      this.decompose(mesh)
    }
  },
  makeReference(shapes = undefined) {
    this.grabConstruct(null);
    if (!shapes) shapes = Array.from(document.querySelectorAll('*[primitive-construct-placeholder]')).filter(el => el.getAttribute('primitive-construct-placeholder').detached)

    let el = document.createElement('a-entity')
    document.querySelector('#reference-spawn').append(el)
    el.classList.add('clickable')

    let targetObj = new THREE.Object3D;
    el.setObject3D('mesh', targetObj);

    Util.whenLoaded(el, () => {
      el.object3D.updateMatrixWorld()
      let animation3d = this.el.sceneEl.systems['animation-3d']
      for (let shape of shapes)
      {
        let mesh = Util.traverseClone(shape.getObject3D('mesh'), animation3d.cloneTracks)
        mesh.el = el
        mesh.traverse(o => o.el = el)
        if (animation3d.hasTracks(shape.object3D))
        {
          // console.log("Copying shape tracks", shape.object3D)
          let object3D = new THREE.Object3D
          object3D.add(mesh)
          Util.applyMatrix(shape.object3D.matrix, object3D)
          Util.applyMatrix(shape.getObject3D('mesh').matrix, mesh)
          animation3d.cloneTracks(shape.object3D, object3D)
          let parent = new THREE.Object3D
          parent.add(object3D)
          targetObj.add(parent)
          Util.positionObject3DAtTarget(parent, shape.object3D.parent)
        }
        else
        {
          targetObj.add(mesh)
          Util.positionObject3DAtTarget(mesh, shape.getObject3D('mesh'))
        }

        shape.parentEl.removeChild(shape)
      }

      let root = el.object3D
      let box = Util.recursiveBoundingBox(root, {onlyVisible: true, includeUI: false, world: false, debug: false})
      box.getCenter(root.position)
      root.updateMatrix()

      let inv = this.pool('inv', THREE.Matrix4)
      inv.copy(root.matrix).invert()

      for (let c of root.children)
      {
        Util.applyMatrix(c.matrix.premultiply(inv), c)
      }

      el.setAttribute('reference-glb', '')
      el.setAttribute('animation-3d-keyframed', '')

      console.log("Made reference", el)
    })
    this.el.sceneEl.emit('refreshobjects')
  },
  makeDrawable() {
    this.grabConstruct(null);
    let shapes = Array.from(document.querySelectorAll('*[primitive-construct-placeholder]')).filter(el => el.getAttribute('primitive-construct-placeholder').detached)

    console.log("Making shapes drawable", shapes)

    let preserveExistingMesh = false && Compositor.nonCanvasMeshes.length > 0

    let boxes = Util.divideCanvasRegions(preserveExistingMesh ? shapes.length + 1 : shapes.length, {margin: 0.01})

    let targetObj = new THREE.Object3D;
    targetObj.el = this.el;
    Compositor.mesh.parent.add(targetObj)

    let {width, height} = Compositor.component
    let layer = new Layer(width, height)
    let layerCtx = layer.canvas.getContext('2d')
    let mapLayers = {}

    for (let map of HANDLED_MAPS) {
      let use = false
      for (let el of shapes)
      {
        let material = el.getObject3D('mesh').material
        if (material[map]
            && material[map].image)
        {
          if (material[map].image.id && material[map].image.id.startsWith("default-"))
          {
            continue;
          }

          use = true
        }
      }
      if (!use) continue;

      mapLayers[map] = Compositor.component.layerforMap(map)
    }

    for (let i = 0; i < shapes.length; i++)
    {
      let el = shapes[i];
      let currentBox = boxes[preserveExistingMesh ? i + 1 : i]
      let mesh = el.getObject3D('mesh').clone()
      mesh.el = el;
      el.object3D.add(mesh);
      // mesh.geometry = mesh.geometry.clone();
      Util.applyUVBox(currentBox, mesh.geometry);
      Util.keepingWorldPosition(mesh, () => {
        mesh.parent.remove(mesh)
        targetObj.add(mesh)
      })

      console.log("Adding", mesh.material)

      let dx = Math.max(Math.floor(currentBox.min.x * width) - 1, 0);
      let dy = Math.max(Math.floor(currentBox.min.y * height) - 1, 0);
      let dw = Math.ceil((currentBox.max.x - currentBox.min.x) * width) + 1
      let dh = Math.ceil((currentBox.max.y - currentBox.min.y) * height) + 1

      if (mesh.material.map && mesh.material.map.image)
      {
        console.log("Drawing mesh image")
        layerCtx.drawImage(mesh.material.map.image,
                           0, 0, mesh.material.map.image.width, mesh.material.map.image.height,
                           dx, dy, dw, dh)

        if (mesh.material.color.r < 1.0 && mesh.material.color.g < 1.0 && mesh.material.color.b < 1.0)
        {
          let drawMode = layerCtx.globalCompositeOperation;
          layerCtx.globalCompositeOperation = 'source-atop'
          layerCtx.fillStyle = mesh.material.color.convertLinearToSRGB().getStyle()
          layerCtx.fillRect(dx, dy, dw, dh)

          layerCtx.globalCompositeOperation = drawMode
        }

      }
      else
      {
        layerCtx.fillStyle = mesh.material.color.convertLinearToSRGB().getStyle()
        layerCtx.fillRect(dx, dy, dw, dh)
      }

      for (let map in mapLayers)
      {
        if (!mesh.material[map] || !mesh.material[map].image) continue;
        mapLayers[map].canvas.getContext('2d').drawImage(
          mesh.material[map].image,
          0, 0, mesh.material[map].image.width, mesh.material[map].image.height,
          dx, dy, dw, dh)
      }
    }

    if (preserveExistingMesh)
    {
      for (let mesh of Compositor.nonCanvasMeshes)
      {
        mesh.geometry = mesh.geometry.clone();
        Util.applyUVBox(boxes[0], mesh.geometry)
      }
    }

    Util.keepingWorldPosition(targetObj, () => {
      this.el.sceneEl.systems['settings-system'].addModelView({scene: targetObj}, {replace: false})
    })

    Compositor.component.addLayer(0, {layer})

    if (Compositor.el.getAttribute('material').shader === 'flat')
    {
      Compositor.el.setAttribute('material', 'shader', 'standard')
    }

    for (let shape of shapes)
    {
      shape.parentEl.removeChild(shape)
    }
  },
  clearAll() {
    this.grabConstruct(null);
    let shapes = Array.from(document.querySelectorAll('*[primitive-construct-placeholder]')).filter(el => el.getAttribute('primitive-construct-placeholder').detached)
    for (let el of shapes)
    {
      el.object3D.parent.remove(el.object3D)
      Util.disposeEl(el)
    }
  }
})

AFRAME.registerComponent("show-current-color-or-material", {
  events: {
    object3dset: function(e) { this.onMaterialUpdated() }
  },
  init() {
    this.onMaterialUpdated = this.onMaterialUpdated.bind(this)
  },
  play() {
    this.el.sceneEl.addEventListener('shapematerialupdated', this.onMaterialUpdated)
    this.onMaterialUpdated()
  },
  pause() {
    this.el.sceneEl.removeEventListener('shapematerialupdated', this.onMaterialUpdated)
  },
  onMaterialUpdated() {
    let mesh = this.el.getObject3D('mesh')
    if (!mesh) return;

    mesh.material = this.el.sceneEl.systems['threed-line-system'].getMaterial()
  },
})

AFRAME.registerComponent('refresh-material-when-visible', {
  schema: {
    throttle: {default: 10},
  },
  init() {
    this.tick = AFRAME.utils.throttleTick(this.tick, this.data.throttle, this)
  },
  tick(t, dt) {
    if (Util.visibleWithAncestors(this.el.object3D)) {
      this.el.sceneEl.systems['threed-line-system'].getMaterial()
    }
  }
})

AFRAME.registerComponent('primitive-construct-placeholder', {
  dependencies: ['raycast-bvh'],
  schema: {
    primitive: {default: ""},
    gltfModel: {default: ""},
    manualMesh: {default: false},
    detached: {default: false},

    // TODO Transparent
  },
  events: {
    stateadded: function(e) {
      if (e.detail === 'grabbed')
      {
        if (!this.data.detached)
        {
          this.detachCopy()
          Undo.push(() => {
            this.el.remove()
          })
        }
        else
        {
          Undo.pushObjectMatrix(this.el.object3D)
        }
        if (this.el.grabbingManipulator && this.el.grabbingManipulator.attrName === 'selection-box-tool')
        {
          this.system.grabConstruct(null)
        }
        else
        {
          this.system.grabConstruct(this.el)
        }
      }
    },
    'bbuttonup': function(e) {
      if (this.el.is("grabbed"))
      {
        this.makeClone()
      }
      else
      {
        this.system.grabConstruct(null)
      }
    },
  },
  init() {
    this.system = this.el.sceneEl.systems['primitive-constructs'];
    if (this.data.gltfModel)
    {
      this.el.setAttribute('gltf-model', this.data.gltfModel)
      Util.whenLoaded(this.el, () => {
        let m = this.el.getObject3D('mesh').getObjectByProperty('type', 'Mesh')
        m.parent.remove(m)
        this.el.object3D.add(m)
        this.el.object3D.setObject3D('mesh', m)
        m.material = this.el.components.material.material
      })
    }
    else if (this.data.primitive)
    {
      this.el.setAttribute('geometry', `primitive: ${this.data.primitive};`)
    }
    else if (this.data.manualMesh)
    {
    }

    if (!this.data.detached)
    {
      this.el.setAttribute('show-current-color-or-material', '')
    }
    this.el.classList.add('clickable')
    this.el.setAttribute('action-tooltips', 'b: Clone shape (Grabbed)')
  },
  update(oldData) {
    if (this.data.detached) {
      this.el.setAttribute('mesh-can-be-clipped', '')
      if (!this.el.getObject3D('mesh').material)
      {
        console.error("No material for", this.el, this.el.getObject3D('mesh'))
      }
      if (this.el.getObject3D('mesh').material.length || !this.el.getObject3D('mesh').material.transparent)
      {
        this.el.setAttribute('shadow', 'cast', true)
      }
    }
  },
  remove() {
    this.el.getObject3D('mesh').traverse(o => {
      if (o.material) o.material.dispose()
      if (o.geometry) o.geometry.dispose()
    })
  },
  detachCopy() {
    console.log("Detaching copy", this.el)

    this.el.removeAttribute('show-current-color-or-material')

    let newPlaceHolder = document.createElement('a-entity')
    this.el.parentEl.append(newPlaceHolder)
    newPlaceHolder.setAttribute('geometry', this.el.getAttribute('geometry'))
    newPlaceHolder.setAttribute('primitive-construct-placeholder', this.el.getAttribute('primitive-construct-placeholder'))
    newPlaceHolder.setAttribute('position', this.el.getAttribute('position'))
    this.el.setAttribute('primitive-construct-placeholder', 'detached', true)

    Util.keepingWorldPosition(this.el.object3D, () => {
      this.el.object3D.parent.remove(this.el.object3D)
      this.system.data.container.object3D.add(this.el.object3D)
    })

    this.el.getObject3D('mesh').geometry = this.el.getObject3D('mesh').geometry.clone()
  },
  makeClone() {
    let wasDetached = this.el.getAttribute('primitive-construct-placeholder').detached
    console.log("Cloning", this.el, wasDetached)
    let newPlaceHolder = document.createElement('a-entity')
    this.el.parentEl.append(newPlaceHolder)
    newPlaceHolder.setAttribute('geometry', this.el.getAttribute('geometry'))
    newPlaceHolder.setAttribute('primitive-construct-placeholder', this.el.getAttribute('primitive-construct-placeholder'))
    this.el.setAttribute('primitive-construct-placeholder', 'detached', true)
    Util.whenLoaded(newPlaceHolder, () => {
      this.system.data.container.object3D.add(newPlaceHolder.object3D)
      Util.positionObject3DAtTarget(newPlaceHolder.object3D, this.el.object3D)
      newPlaceHolder.getObject3D('mesh').geometry = this.el.getObject3D('mesh').geometry.clone()

      if (!wasDetached || !this.system.data.shareMaterial)
      {
        newPlaceHolder.getObject3D('mesh').material = this.el.getObject3D('mesh').material.clone()
      }
      else
      {
        newPlaceHolder.getObject3D('mesh').material = this.el.getObject3D('mesh').material
      }

      this.el.sceneEl.systems['animation-3d'].cloneTracks(this.el.getObject3D('mesh'), newPlaceHolder.getObject3D('mesh'))
      this.el.sceneEl.systems['animation-3d'].cloneTracks(this.el.object3D, newPlaceHolder.object3D)
    })
  },
  makeReal() {
  },
})

AFRAME.registerComponent('grouping-tool', {
  dependencies: ['selection-box-tool'],
  events: {
    grabstarted: function(e) {
      if (!this.el.components['selection-box-tool'].grabbing) return;

      console.log("Grabbed", e.detail.grabbed)
      this.el.components['selection-box-tool'].toggleGrabbing(false)
      this.el.sceneEl.systems['primitive-constructs'].makeReference(Object.values(e.detail.grabbed))
    }
  },
  init() {
    this.el.setAttribute('selection-box-tool', 'selector', 'a-entity[primitive-construct-placeholder], .reference-glb')
  },
})
