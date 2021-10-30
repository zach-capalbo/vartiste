import {Util} from './util.js'
import {Layer} from './layer.js'
import {Undo} from './undo.js'
import {Pool} from './pool.js'
import {HANDLED_MAPS} from './material-packs.js'
import './extra-geometries.js'

Util.registerComponentSystem('primitive-constructs', {
  schema: {
    container: {type: 'selector', default: '#canvas-root'},
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
      this.lastGrabbed.removeAttribute('axis-handles')
      if (this.lastGrabbed.hasAttribute('vertex-handles'))
      {
        this.lastGrabbed.getObject3D('mesh').geometry.computeBoundsTree()
      }
      this.lastGrabbed.removeAttribute('vertex-handles')
      this.lastGrabbed.removeAttribute('frame')
    }
    this.lastGrabbed = el

    if (!el) return;

    el.setAttribute('axis-handles', 'apply: true')
    el.setAttribute('frame', 'pinnable: false; outline: false; useBounds: true')
    Util.whenComponentInitialized(el, 'frame', () => {
      let button = el.components.frame.addButton('#asset-dots-square')
      button.setAttribute('tooltip', 'Edit Vertices')
      button.addEventListener('click', () => {
        el.setAttribute('vertex-handles', '')
        el.removeAttribute('axis-handles')
        el.removeAttribute('frame')
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
      for (let shape of shapes)
      {
        let mesh = shape.getObject3D('mesh').clone();
        mesh.el = el
        mesh.traverse(o => o.el = el)
        targetObj.add(mesh)
        Util.positionObject3DAtTarget(mesh, shape.getObject3D('mesh'))
        shape.parentEl.removeChild(shape)
      }

      el.setAttribute('reference-glb', '')

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
  }
})

AFRAME.registerComponent("show-current-color-or-material", {
  init() {
    this.system = this.el.sceneEl.systems['paint-system']
    if (this.el.sceneEl.systems['material-pack-system'].activeMaterialMask)
    {
      this.applyMaps(this.el.sceneEl.systems['material-pack-system'].activeMaterialMask.maps)
    }
    else
    {
      this.el.setAttribute('material', {shader: 'flat', color: this.system.data.color})
    }
    this.onColorChanged = (e) => {
      if (!this.el.sceneEl.systems['material-pack-system'].activeMaterialMask)
      {
        this.applyMaps({metalnessMap: null, metalness: null, roughnessMap: null, ambientOcclusionMap: null, normalMap: null})
        this.el.setAttribute('material', {color: e.detail.color})
      }
    }
    this.el.sceneEl.addEventListener('colorchanged', this.onColorChanged)

    this.onMaterialMaskChanged = (e) => {
      console.log("mask",e.detail.mask)
      let maps = e.detail.mask.maps
      this.applyMaps(maps)
    }
    this.el.sceneEl.addEventListener('materialmaskactivated', this.onMaterialMaskChanged)
  },
  remove() {
    this.el.sceneEl.removeEventListener('colorchanged', this.onColorChanged)
    this.el.sceneEl.removeEventListener('materialmaskactivated', this.onMaterialMaskChanged)
  },
  applyMaps(maps) {
    this.el.setAttribute('material', {color: '#FFFFFF', src: maps.src, shader: 'standard', metalnessMap: maps.metalnessMap, metalness: maps.metalness, roughnessMap: maps.roughnessMap, ambientOcclusionMap: maps.aoMap, normalMap: maps.normalMap})
  }
})

AFRAME.registerComponent('primitive-construct-placeholder', {
  // dependencies: ['raycast-bvh'],
  schema: {
    primitive: {default: ""},
    gltfModel: {default: ""},
    manualMesh: {default: false},
    detached: {default: false},
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
          let startMatrix = new THREE.Matrix4
          startMatrix.copy(this.el.object3D.matrix)
          Undo.push(() => {
            Util.applyMatrix(startMatrix, this.el.object3D)
          })
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
      this.el.setAttribute('material', `shader: standard`)
    }
    this.el.classList.add('clickable')
    this.el.setAttribute('action-tooltips', 'b: Clone shape')
  },
  update(oldData) {},
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
