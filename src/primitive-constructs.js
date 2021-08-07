import {Util} from './util.js'
import {Layer} from './layer.js'

const unwrappedUvs = [0.3333333432674408, 1, 0.3333333432674408, 0.5, 0, 1, 0, 0.5, 0, 0.5, 0, 0, 0.3333333432674408, 0.5, 0.3333333432674408, 0, 0.6666666865348816, 0.5, 0.6666666865348816, 1, 1, 0.5, 1, 1, 0.6666666865348816, 0.5, 0.6666666865348816, 0, 1, 0.5, 1, 0, 0.3333333432674408, 1, 0.3333333432674408, 0.5, 0.6666666865348816, 1, 0.6666666865348816, 0.5, 0.6666666865348816, 0.5, 0.6666666865348816, 0, 0.3333333432674408, 0.5, 0.3333333432674408, 0];

AFRAME.registerGeometry('unwrapped-box', {
  schema: {
    depth: {default: 1, min: 0},
    height: {default: 1, min: 0},
    width: {default: 1, min: 0},
    segmentsHeight: {default: 1, min: 1, max: 20, type: 'int'},
    segmentsWidth: {default: 1, min: 1, max: 20, type: 'int'},
    segmentsDepth: {default: 1, min: 1, max: 20, type: 'int'}
  },

  init: function (data) {
    this.geometry = new THREE.BoxGeometry(data.width, data.height, data.depth);
    console.log(this.geometry.attributes.uv)
    this.geometry.attributes.uv.array.set(unwrappedUvs)
    this.geometry.attributes.uv.needsUpdate = true
  }
});

AFRAME.registerComponent('floating-trash-can', {
  init() {
    this.el.setAttribute('frame', 'pinnable: false; outline: false; useBounds: true')
  },
  remove() {
    this.el.removeAttribute('frame')
  }
})

Util.registerComponentSystem('primitive-constructs', {
  grabConstruct(el) {
    if (el === this.lastGrabbed) return;

    if (this.lastGrabbed)
    {
      this.lastGrabbed.removeAttribute('axis-handles')
      this.lastGrabbed.removeAttribute('vertex-handles')
      this.lastGrabbed.removeAttribute('floating-trash-can')
    }
    this.lastGrabbed = el

    if (!el) return;

    el.setAttribute('axis-handles', '')
    el.setAttribute('vertex-handles', '')
    el.setAttribute('floating-trash-can', '')
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

      layerCtx.fillStyle = mesh.material.color.convertLinearToSRGB().getStyle()
      layerCtx.fillRect(Math.max(Math.floor(currentBox.min.x * width) - 1, 0),
                        Math.max(Math.floor(currentBox.min.y * height) - 1, 0),
                        Math.ceil(currentBox.max.x * width) + 1,
                        Math.ceil(currentBox.max.y * height) + 1)
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
    detached: {default: false},
  },
  events: {
    stateadded: function(e) {
      if (e.detail === 'grabbed')
      {
        if (!this.data.detached)
        {
          this.detachCopy()
        }
        this.system.grabConstruct(this.el)
      }
    },
    'bbuttonup': function(e) {
      if (this.el.is("grabbed"))
      {
        this.detachCopy()
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
    this.el.setAttribute('show-current-color', '')
    this.el.setAttribute('material', `shader: standard`)
    this.el.classList.add('clickable')
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
  makeReal() {
  },
})
