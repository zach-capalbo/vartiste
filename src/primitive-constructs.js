import {Util} from './util.js'
import {Layer} from './layer.js'
import {Undo} from './undo.js'
import './extra-geometries.js'

Util.registerComponentSystem('primitive-constructs', {
  grabConstruct(el) {
    if (el === this.lastGrabbed) return;

    if (this.lastGrabbed)
    {
      this.lastGrabbed.removeAttribute('axis-handles')
      this.lastGrabbed.removeAttribute('vertex-handles')
      this.lastGrabbed.removeAttribute('frame')
    }
    this.lastGrabbed = el

    if (!el) return;

    el.setAttribute('axis-handles', '')
    el.setAttribute('frame', 'pinnable: false; outline: false; useBounds: true')
    Util.whenComponentInitialized(el, 'frame', () => {
      let button = el.components.frame.addButton('#asset-cylinder')
      button.setAttribute('tooltip', 'Edit Vertices')
      button.addEventListener('click', () => {
        el.setAttribute('vertex-handles', '')
        el.removeAttribute('axis-handles')
        el.removeAttribute('frame')
      })
      this.el.sceneEl.emit('refreshobjects')
    })
  },
  makeReference() {
    this.grabConstruct(null);
    let shapes = Array.from(document.querySelectorAll('*[primitive-construct-placeholder]')).filter(el => el.getAttribute('primitive-construct-placeholder').detached)

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
        targetObj.add(mesh)
        Util.positionObject3DAtTarget(mesh, shape.getObject3D('mesh'))
        shape.parentEl.removeChild(shape)
      }

      el.setAttribute('reference-glb', '')
      console.log("Made reference", el)
    })
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

      if (mesh.material.map && mesh.material.map.image)
      {
        console.log("Drawing mesh image")
        layerCtx.drawImage(mesh.material.map.image,
                           0, 0, mesh.material.map.image.width, mesh.material.map.image.height,
                           Math.max(Math.floor(currentBox.min.x * width) - 1, 0),
                           Math.max(Math.floor(currentBox.min.y * height) - 1, 0),
                           Math.ceil((currentBox.max.x - currentBox.min.x) * width) + 1,
                           Math.ceil((currentBox.max.y - currentBox.min.y) * height) + 1)

        if (mesh.material.color.r < 1.0 && mesh.material.color.g < 1.0 && mesh.material.color.b < 1.0)
        {
          let drawMode = layerCtx.globalCompositeOperation;
          layerCtx.globalCompositeOperation = 'source-atop'
          layerCtx.fillStyle = mesh.material.color.convertLinearToSRGB().getStyle()
          layerCtx.fillRect(
            Math.max(Math.floor(currentBox.min.x * width) - 1, 0),
            Math.max(Math.floor(currentBox.min.y * height) - 1, 0),
            Math.ceil((currentBox.max.x - currentBox.min.x) * width) + 1,
            Math.ceil((currentBox.max.y - currentBox.min.y) * height) + 1)

          layerCtx.globalCompositeOperation = drawMode
        }

      }
      else
      {
        layerCtx.fillStyle = mesh.material.color.convertLinearToSRGB().getStyle()
        layerCtx.fillRect(Math.max(Math.floor(currentBox.min.x * width) - 1, 0),
                          Math.max(Math.floor(currentBox.min.y * height) - 1, 0),
                          Math.ceil(currentBox.max.x * width) + 1,
                          Math.ceil(currentBox.max.y * height) + 1)
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

AFRAME.registerComponent('primitive-construct-placeholder', {
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
        this.system.grabConstruct(this.el)
      }
    },
    'bbuttonup': function(e) {
      if (this.el.is("grabbed"))
      {
        this.makeClone()
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
      this.el.setAttribute('show-current-color', '')
      this.el.setAttribute('material', `shader: standard`)
    }
    this.el.classList.add('clickable')
    this.el.setAttribute('action-tooltips', 'b: Clone shape')
  },
  update(oldData) {},
  detachCopy() {
    console.log("Detaching copy", this.el)

    this.el.removeAttribute('show-current-color')

    let newPlaceHolder = document.createElement('a-entity')
    this.el.parentEl.append(newPlaceHolder)
    newPlaceHolder.setAttribute('geometry', this.el.getAttribute('geometry'))
    newPlaceHolder.setAttribute('primitive-construct-placeholder', this.el.getAttribute('primitive-construct-placeholder'))
    newPlaceHolder.setAttribute('position', this.el.getAttribute('position'))
    this.el.setAttribute('primitive-construct-placeholder', 'detached', true)

    Util.keepingWorldPosition(this.el.object3D, () => {
      this.el.object3D.parent.remove(this.el.object3D)
      this.el.sceneEl.object3D.add(this.el.object3D)
    })

    this.el.getObject3D('mesh').geometry = this.el.getObject3D('mesh').geometry.clone()
  },
  makeClone() {
    console.log("Cloning", this.el)
    let newPlaceHolder = document.createElement('a-entity')
    this.el.parentEl.append(newPlaceHolder)
    newPlaceHolder.setAttribute('geometry', this.el.getAttribute('geometry'))
    newPlaceHolder.setAttribute('primitive-construct-placeholder', this.el.getAttribute('primitive-construct-placeholder'))
    this.el.setAttribute('primitive-construct-placeholder', 'detached', true)
    Util.whenLoaded(newPlaceHolder, () => {
      this.el.sceneEl.object3D.add(newPlaceHolder.object3D)
      Util.positionObject3DAtTarget(newPlaceHolder.object3D, this.el.object3D)
      newPlaceHolder.getObject3D('mesh').geometry = this.el.getObject3D('mesh').geometry.clone()
      newPlaceHolder.getObject3D('mesh').material = this.el.getObject3D('mesh').material.clone()
    })
  },
  makeReal() {
  },
})
