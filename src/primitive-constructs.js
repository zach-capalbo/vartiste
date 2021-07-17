import {Util} from './util.js'

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

Util.registerComponentSystem('primitive-constructs', {
  grabConstruct(el) {
    if (el === this.lastGrabbed) return;

    if (this.lastGrabbed)
    {
      this.lastGrabbed.removeAttribute('axis-handles')
    }
    this.lastGrabbed = el

    if (!el) return;

    el.setAttribute('axis-handles', '')
  },
  makeDrawable() {
    this.grabConstruct(null);
    let shapes = Array.from(document.querySelectorAll('*[primitive-construct-placeholder]')).filter(el => el.getAttribute('primitive-construct-placeholder').detached)

    console.log(shapes)

    let preserveExistingMesh = Compositor.nonCanvasMeshes.length > 0

    let boxes = Util.divideCanvasRegions(preserveExistingMesh ? shapes.length + 1 : shapes.length, {margin: 0.01})

    let targetObj = document.getElementById('composition-view').getObject3D('mesh')

    if (!targetObj) {
      targetObj = new THREE.Object3D;
      document.getElementById('composition-view').setObject3D('mesh', targetObj)
    }

    for (let i = 0; i < shapes.length; i++)
    {
      let el = shapes[i];
      let currentBox = boxes[preserveExistingMesh ? i + 1 : i]
      let mesh = el.getObject3D('mesh')
      mesh.geometry = mesh.geometry.clone();
      let attr = mesh.geometry.attributes.uv

      for (let i = 0; i < attr.count; ++i)
      {
        attr.setXY(i,
          THREE.Math.mapLinear(attr.getX(i) % 1.00000000000001, 0, 1, currentBox.min.x, currentBox.max.x),
          THREE.Math.mapLinear(attr.getY(i) % 1.00000000000001, 0, 1, currentBox.min.y, currentBox.max.y))
      }

      attr.needsUpdate = true

      Util.keepingWorldPosition(mesh, () => {
        this.el.sceneEl.systems['settings-system'].addModelView({scene: mesh}, {replace: false})
      })
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
    }
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
  },
  makeReal() {
  },
})
