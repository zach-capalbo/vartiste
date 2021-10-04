import {Sfx} from './sfx.js'
import {Util} from './util.js'

const DEFAULT_BUTTON_STYLE_SCHEMA = {
  color: {type: 'color', default: "#abe"},
  clickColor: {type: 'color', default: '#aea'},
  intersectedColor: {type: 'color', default: '#cef'},
  toggleOnColor: {type: 'color', default: '#bea'},
  keepAspect: {type: 'bool', default: true},
  buttonType: {default: 'button'}
}

const DEFAULT_BUTTON_STYLE = {}
for (let k in DEFAULT_BUTTON_STYLE_SCHEMA) {
  DEFAULT_BUTTON_STYLE[k] = DEFAULT_BUTTON_STYLE_SCHEMA[k].default
}

// Allows you to set the styling for an `icon-button`.
//
// E.g.:
//
// ```
// <a-entity icon-button="#my-icon" button-style="color: blue"></a-entity>
//```
AFRAME.registerComponent('button-style', {
  schema: {
    color: {type: 'color', default: "#b6c5f2"},
    clickColor: {type: 'color', default: '#aea'},
    intersectedColor: {type: 'color', default: '#cef'},
    toggleOnColor: {type: 'color', default: '#bea'},

    // If true, preserves icon image aspect ratio
    keepAspect: {type: 'bool', default: true},

    // Either 'flat' or 'button'
    buttonType: {default: 'button'}
  }
})

export const [
  STATE_NORMAL,
  STATE_HOVERED,
  STATE_PRESSED,
  STATE_TOGGLED
] = [
  "BUTTON_STATE_NORMAL",
  "BUTTON_STATE_HOVERED",
  "BUTTON_STATE_PRESSED",
  "BUTTON_STATE_TOGGLED"
]

function RoundEdgedBox(width, height, depth, radius, widthSegments, heightSegments, depthSegments, smoothness) {

    width = width || 1;
    height = height || 1;
    depth = depth || 1;
    radius = radius || (Math.min(Math.min(width, height), depth) * .25);
    widthSegments = Math.floor(widthSegments) || 1;
    heightSegments = Math.floor(heightSegments) || 1;
    depthSegments = Math.floor(depthSegments) || 1;
    smoothness = Math.max(3, Math.floor(smoothness) || 3);

    var halfWidth = width * .5 - radius;
    var halfHeight = height * .5 - radius;
    var halfDepth = depth * .5 - radius;

    var geometry = new THREE.Geometry();

    // corners - 4 eighths of a sphere
    var corner1 = new THREE.SphereGeometry(radius, smoothness, smoothness, 0, Math.PI * .5, 0, Math.PI * .5);
    corner1.translate(-halfWidth, halfHeight, halfDepth);
    var corner2 = new THREE.SphereGeometry(radius, smoothness, smoothness, Math.PI * .5, Math.PI * .5, 0, Math.PI * .5);
    corner2.translate(halfWidth, halfHeight, halfDepth);
    var corner3 = new THREE.SphereGeometry(radius, smoothness, smoothness, 0, Math.PI * .5, Math.PI * .5, Math.PI * .5);
    corner3.translate(-halfWidth, -halfHeight, halfDepth);
    var corner4 = new THREE.SphereGeometry(radius, smoothness, smoothness, Math.PI * .5, Math.PI * .5, Math.PI * .5, Math.PI * .5);
    corner4.translate(halfWidth, -halfHeight, halfDepth);

    geometry.merge(corner1);
    geometry.merge(corner2);
    geometry.merge(corner3);
    geometry.merge(corner4);

    // edges - 2 fourths for each dimension
    // width
    var edge = new THREE.CylinderGeometry(radius, radius, width - radius * 2, smoothness, widthSegments, true, 0, Math.PI * .5);
    edge.rotateZ(Math.PI * .5);
    edge.translate(0, halfHeight, halfDepth);
    var edge2 = new THREE.CylinderGeometry(radius, radius, width - radius * 2, smoothness, widthSegments, true, Math.PI * 1.5, Math.PI * .5);
    edge2.rotateZ(Math.PI * .5);
    edge2.translate(0, -halfHeight, halfDepth);

    // height
    var edge3 = new THREE.CylinderGeometry(radius, radius, height - radius * 2, smoothness, heightSegments, true, 0, Math.PI * .5);
    edge3.translate(halfWidth, 0, halfDepth);
    var edge4 = new THREE.CylinderGeometry(radius, radius, height - radius * 2, smoothness, heightSegments, true, Math.PI * 1.5, Math.PI * .5);
    edge4.translate(-halfWidth, 0, halfDepth);

    // depth
    var edge5 = new THREE.CylinderGeometry(radius, radius, depth - radius * 2, smoothness, depthSegments, true, 0, Math.PI * .5);
    edge5.rotateX(-Math.PI * .5);
    edge5.translate(halfWidth, halfHeight, 0);
    var edge6 = new THREE.CylinderGeometry(radius, radius, depth - radius * 2, smoothness, depthSegments, true, Math.PI * .5, Math.PI * .5);
    edge6.rotateX(-Math.PI * .5);
    edge6.translate(halfWidth, -halfHeight, 0);

    edge.merge(edge2);
    edge.merge(edge3);
    edge.merge(edge4);
    edge.merge(edge5);
    edge.merge(edge6);

    // sides
    // front
    var side = new THREE.PlaneGeometry(width - radius * 2, height - radius * 2, widthSegments, heightSegments);
    side.translate(0, 0, depth * .5);

    // right
    var side2 = new THREE.PlaneGeometry(depth - radius * 2, height - radius * 2, depthSegments, heightSegments);
    side2.rotateY(Math.PI * .5);
    side2.translate(width * .5, 0, 0);

    side.merge(side2);

    geometry.merge(edge);
    geometry.merge(side);

    // duplicate and flip
    var secondHalf = geometry.clone();
    secondHalf.rotateY(Math.PI);
    geometry.merge(secondHalf);

    // top
    var top = new THREE.PlaneGeometry(width - radius * 2, depth - radius * 2, widthSegments, depthSegments);
    top.rotateX(-Math.PI * .5);
    top.translate(0, height * .5, 0);

    // bottom
    // var bottom = new THREE.PlaneGeometry(width - radius * 2, depth - radius * 2, widthSegments, depthSegments);
    // bottom.rotateX(Math.PI * .5);
    // bottom.translate(0, -height * .5, 0);

    geometry.merge(top);
    // geometry.merge(bottom);
    geometry.mergeVertices();
    geometry.computeVertexNormals();
    geometry.computeFaceNormals();

    // geometry.faces = geometry.faces.filter(f => f.a.z > 0 || f.b.z > 0 || f.c.z > 0 )
    let up = new THREE.Vector3(0, 0, 1)
    // geometry.faces = geometry.faces.filter(f => up.dot(f.normal) > -0.5 )


    return geometry;
  }

// System to handle caching and sharing of materials for icon buttons. At the
// moment, it is best not to change these values dynamically.
AFRAME.registerSystem('icon-button', {
  schema: {
    // **[flat, matcap, or stanadard]** Shader to use for the button geometry.
    shader: {default: 'matcap'},
    // **[flat, matcap, or stanadard]** Shader to use for the button icon.
    iconShader: {default: 'flat'},
    // If using matcap shader, which matcap to use
    matcap: {default: '#asset-matcap', type: 'map'},
    // For use with standard shader
    metalness: {default: 0.3},
    // For use with standard shader
    roughness: {default: 1.0}
  },
  init() {
    this.width = 0.4
    this.depth = 0.05
    // this.geometry = new THREE.BufferGeometry().fromGeometry(RoundEdgedBox(this.width, this.width, this.depth - 0.005))

    if (Util.isLowPower())
    {
      this.geometry = new THREE.BoxBufferGeometry(this.width, this.width, this.depth - 0.005)
    }
    else
    {
      new THREE.GLTFLoader().load(document.getElementById('asset-button').getAttribute('src'), (gltf) => {
        let scaleMatrix = new THREE.Matrix4().makeScale(this.width, this.width, this.depth - 0.005)
        this.geometry = gltf.scene.getObjectByProperty('type', 'Mesh').geometry
        this.geometry.applyMatrix4(scaleMatrix)
      })
    }
    this.frontGeometry = new THREE.PlaneBufferGeometry(this.width - 0.01, this.width - 0.01)
    this.colorManagement = this.el.getAttribute('renderer').colorManagement;

    this.blankFaceMaterial = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0,
      alphaTest: 0.01,
      toneMapped: false
    })
    this.faceMaterials = {}

    this.bgMaterials = {}

    if (this.data.shader === 'matcap')
    {
      this.bgMaterial = new THREE.MeshMatcapMaterial({toneMapped: false})
      this.bgMaterial.matcap = new THREE.Texture()
      this.bgMaterial.matcap.image = this.data.matcap
      this.bgMaterial.matcap.encoding = THREE.LinearEncoding
      this.bgMaterial.matcap.needsUpdate = true
    }
    else if (this.data.shader === 'standard')
    {
      this.bgMaterial = new THREE.MeshStandardMaterial({metalness: 0.3, roughness: 1.0})
    }
    else
    {
      this.bgMaterial = new THREE.MeshBasicMaterial({toneMapped: false})
    }

    this.tmpColor = new THREE.Color()
  }
})

// Creates a square, clickable button with an icon on front.
//
// #### Usage Notes
//
// - Multiple `icon-button` will automatically arrange themselves in a row
// depending on how many siblings it has in its parent element.
// - `icon-button` has an implicit [`propogate-grab`](#propogate-grab), so
//   placing them as children of a grabbable entity will automatically redirect
//   grabs of the icon-button to the grabbable parent.
//
// Can be used wit [`icon-row`](#icon-row) for easy layouts. For instance,
// the snippet:
//
//```
//        <a-entity icon-row="">
//          <a-entity icon-button="#asset-close"></a-entity>
//          <a-entity icon-button="#asset-camera"></a-entity>
//          <a-entity icon-button="" text="value: 3; color: #FFF; wrapCount: 3; align: center; width: 0.4"></a-entity>
//        </a-entity>
//        <a-entity icon-row="">
//          <a-entity icon-button="#asset-chevron-up"></a-entity>
//          <a-entity icon-button="#asset-brush"></a-entity>
//          <a-entity icon-button="" button-style="color: green;"></a-entity>
//          <a-entity icon-button="#asset-delete" button-style="color: red;"></a-entity>
//        </a-entity>
//```
//
// Will create the following:
//
// ![Two rows of buttons, all lined up nicely](./static/images/iconbuttonrow.png)
AFRAME.registerComponent('icon-button', {
  dependencies: ['button-style'],

  // Should be a selector for an image asset, or a texture map (anything that
  // can go into a `material` `map` property should work)
  schema: {type:'string', default: ""},
  events: {
    stateadded: function(e) { this.updateStateColor() },
    stateremoved: function(e) { this.updateStateColor() },
    componentchanged: function(e) { if (e.detail.name === 'button-style') this.updateStateColor() },
    'raycaster-intersected': function(e) { this.el.addState(STATE_HOVERED)},
    'raycaster-intersected-cleared': function(e) { this.el.removeState(STATE_HOVERED)},
  },
  init() {
    let width = this.system.width
    let height = width
    let depth = this.system.depth

    this.state = STATE_NORMAL

    let buttonStyle
    if (this.el.hasAttribute('button-style'))
    {
       buttonStyle = this.el.getAttribute('button-style')
    }
    else
    {
      buttonStyle = DEFAULT_BUTTON_STYLE
    }

    this.style = buttonStyle

    if (buttonStyle.buttonType === 'plane')
    {
      depth = 0.001
    }

    this.el.setObject3D('mesh', new THREE.Mesh(this.system.frontGeometry, this.system.blankFaceMaterial))
    // this.el.setObject3D('mesh', new THREE.Mesh(this.system.frontGeometry, new THREE.MeshStandardMaterial({transparent: true, fog: false)))

    // Inline propogate-grab
    for (let parent = this.el.parentEl; parent; parent = parent.parentEl)
    {
      if (parent['redirect-grab'] || parent.classList.contains('clickable') || parent.classList.contains('grab-root'))
      {
        this.el['redirect-grab'] = parent
        break;
      }
    }

    this.el.classList.add('clickable')

    let indexId = Array.from(this.el.parentEl.children).filter(e => e.hasAttribute('icon-button')).indexOf(this.el)
    this.el.object3D.position.z += depth
    this.el.object3D.position.x += (width + 0.05) * indexId

    let bg;
    if (buttonStyle.buttonType === 'plane')
    {
      bg = new THREE.Mesh(this.system.frontGeometry, this.system.bgMaterial)
      bg.position.set(0,0,- 0.01)
    }
    else
    {
      bg = new THREE.Mesh(this.system.geometry, this.system.bgMaterial)
      bg.position.set(0,0,- depth / 2)
    }

    this.el.getObject3D('mesh').add(bg)
    this.bg = bg
    this.fg = this.el.getObject3D('mesh')

    this.el.addEventListener('click', (e) => {
      this.clickTime = this.el.sceneEl.time
      if (e.detail.cursorEl)
      {
        Sfx.click(e.detail.cursorEl)
      }
      this.addState(STATE_PRESSED)
      //this.setColor(buttonStyle.clickColor)
    })

    this.el.addEventListener('object3dset', (e) => {
      this.updateAspect()
      this.updateStateColor()
    })

    this.updateStateColor()

    this.el.actionTooltips = {trigger: 'Click Button'}

    this.tick = AFRAME.utils.throttleTick(this.tick, 80, this)
  },
  update(oldData) {
    if (!this.el.attached) throw new Error("Not attached!")
    if (this.system.faceMaterials[this.data])
    {
      this.el.getObject3D('mesh').material = this.system.faceMaterials[this.data]
    }
    else
    {
      this.el.setAttribute('material', {
        alphaTest: 0.01,
        color: '#FFF',
        fog: false,
        src: this.data,
        transparent: true,
        shader: this.system.data.iconShader,
        opacity: this.data === "" ? 0.0 : 1.0
      })

      this.el.components.material.material.toneMapped = false

      if (!((this.data instanceof HTMLImageElement) || this.data.startsWith("data")))
      {
        this.system.faceMaterials[this.data] = this.el.getObject3D('mesh').material
      }
    }
    this.updateAspect()
  },
  addState(state) {
    this.el.addState(state)
  },
  removeState(state) {
    this.el.removeState(state)
  },
  updateStateColor() {
    if (this.el.is(STATE_PRESSED))
    {
      this.setColor(this.style.clickColor)
      return
    }
    if (this.el.is(STATE_HOVERED))
    {
      this.setColor(this.style.intersectedColor)
      return
    }
    if (this.el.is(STATE_TOGGLED))
    {
      this.setColor(this.style.toggleOnColor)
      return
    }

    this.setColor(this.style.color)
  },
  setColor(color) {
    let threeColor = this.system.tmpColor
    threeColor.setStyle(color)
    if (this.system.colorManagement) threeColor.convertSRGBToLinear()

    if (this.instanceManager)
    {
      this.instanceManager.setColor(this, threeColor)
    }

    if (this.system.bgMaterials[threeColor.getHex()])
    {
      this.bg.material = this.system.bgMaterials[threeColor.getHex()]
    }
    else
    {
      this.bg.material = this.system.bgMaterial.clone()
      this.bg.material.color.copy(threeColor)
      this.bg.material.needsUpdate = true
      this.system.bgMaterials[threeColor.getHex()] = this.bg.material
    }

    // this.bg.material.needsUpdate = true
  },
  updateAspect() {
    return
    if (this.style && this.style.keepAspect)
    {
      let material = this.el.getObject3D('mesh').material
      if (!material || !material.map) return
      let img = material.map.image
      let aspect = img.width / img.height
      // this.el.setAttribute('geometry', {height: 0.4 / aspect})
    }
  },
  tick(t,ts) {
    if (this.clickTime)
    {
      if (t - this.clickTime > 300) {
        let buttonStyle = this.el.components['button-style'].data
        this.removeState(STATE_PRESSED)
      }
    }
  }
})

// Turns an [`icon-button`](#icon-button) into a toggleable button. Can store
// the toggle state internally, or set and track a property on a component.
AFRAME.registerComponent('toggle-button', {
  dependencies: ['icon-button'],
  schema: {
    // Which element contains the component to set the property on
    target: {type: 'selector'},
    // Which component to set the property on
    component: {type: 'string'},
    // Which property to toggle
    property: {type: 'string'},

    // Not recommended due to lack of update events. Can be used instead of component
    system: {type: 'string'},

    // State of being toggled, when not using target and component
    toggled: {type: 'boolean', default: false}
  },
  events: {
    click: function() {
      if (this.data.target)
      {
        if (this.data.property)
        {
          this.data.target.setAttribute(this.data.component, {[this.data.property]: !this.data.target.getAttribute(this.data.component)[this.data.property]})
        }
        else
        {
          this.data.target.setAttribute(this.data.component, !this.data.target.getAttribute(this.data.component))
        }
      }
      else if (this.data.system)
      {
        this.el.sceneEl.systems[this.data.system].data[this.data.property] = !this.el.sceneEl.systems[this.data.system].data[this.data.property]
        this.setToggle(this.el.sceneEl.systems[this.data.system].data[this.data.property])
      }
      else
      {
        this.data.toggled = !this.data.toggled
        this.setToggle(this.data.toggled)
      }
    }
  },
  update(oldData) {
    if (this.data.target !== oldData.target)
    {
      if (oldData.target)
      {
        oldData.target.removeEventListener('componentchanged', this.componentchangedlistener)
      }

      if (this.data.target)
      {
        this.componentchangedlistener = (e) => {
          if (e.detail.name === this.data.component)
          {
            this.setToggle(!!(this.data.property ? this.data.target.getAttribute(this.data.component)[this.data.property] : this.data.target.getAttribute(this.data.component)), {update: false})
          }
        }
        this.data.target.addEventListener('componentchanged', this.componentchangedlistener)

        Util.whenLoaded([this.el, this.data.target], () => {
          this.setToggle(!!(this.data.property ? this.data.target.getAttribute(this.data.component)[this.data.property] : this.data.target.getAttribute(this.data.component)), {update: false})
        })
      }
      else
      {
        if (this.data.toggled !== oldData.toggled)
        {
          this.setToggle(this.data.toggled)
        }
      }
    }
  },
  setToggle(value) {
    this.data.toggled = value
    if (value)
    {
      this.el.addState(STATE_TOGGLED)
      this.el.components['icon-button'].updateStateColor()
    }
    else
    {
      this.el.removeState(STATE_TOGGLED)
    }
  }
})

// Calls a method of a system or system-component (a component on the scene
// element) when the element recieves a `click` event.
AFRAME.registerComponent('system-click-action', {
  schema: {
    // You should set either system or component
    system: {type: 'string'},
    // You should set either system or component
    component: {type: 'string'},

    // The name of the method to call when clicked
    action: {type: 'string'}
  },
  events: {
    click: function() {
      if (!this.data.action) return;
      console.log("Clicking", this)

      if (this.data.component.length)
      {
        this.el.sceneEl.components[this.data.component][this.data.action]()
      }
      else if (this.data.system.length)
      {
        this.el.sceneEl.systems[this.data.system][this.data.action]()
      }
      else
      {
        try {
          Util.traverseAncestors(this.el, (el) => {
            if (!el.hasAttribute('system-click-action')) return
            let data = el.getAttribute('system-click-action')
            if (data.component)
            {
              this.el.sceneEl.components[data.component][this.data.action]()
              throw 0
            }
            else if (data.system)
            {
              this.el.sceneEl.components[data.system][this.data.action]()
              throw 0
            }
          })
        }
        catch (e) {
          if (e !== 0)
          {
            console.error(e)
          }
        }
      }
    }
  }
})

// Automatically arrange multply rows of `icon-button`s. This will set its
// y-position based on how many icon-rows there are before it in the parent
// element. See [`icon-button`](#icon-button) for an example.
AFRAME.registerComponent('icon-row', {
  schema: {
    // If set to true, it will merge all icon-buttons in this icon-row into a
    // single instanced mesh. Color updates, click events, etc, will still
    // happen as normal. This should provide some performance benefit by
    // reducing the number of draw calls.
    mergeButtons: {default: false},

    // If set to true and `mergeButtons` is also true, this will combine all
    // button icons in the row into a single transparent texture in order to
    // reduce expensive transparent draw calls. Note that this only works as
    // long as the buttons in the icon-row have not been moved out of their
    // default positions
    mergeIcons: {default: true},

    // If set to true, this icon-row will automatically have it's y position
    // adjusted based on the number of other icon-rows in its parent element.
    autoPosition: {default: true},
  },
  events: {
    object3dset: function(e) {
      if (this.data.mergeButtons) this.merge()
    },
    materialtextureloaded: function(e) {
      if (this.data.mergeButtons) this.merge()
    }
  },
  init() {
    if (this.data.autoPosition)
    {
      let indexId = Array.from(this.el.parentEl.children).filter(e => e.hasAttribute('icon-row')).indexOf(this.el)
      this.el.object3D.position.y -= (0.4 + 0.1) * indexId
    }

    this.system = this.el.sceneEl.systems['icon-button']

    if (this.data.mergeButtons) Util.whenLoaded(this.el, () => this.merge())
  },
  async merge() {
    if (!this.data.mergeButtons) return;
    if (this.mergeInProgress) return;
    this.mergeInProgress = true
    this.componentToButton = new Map();
    let buttons = Array.from(this.el.getChildEntities()).filter(el => el.hasAttribute('icon-button'))

    if (buttons.length == 0) return;

    let mesh = new THREE.InstancedMesh(this.system.geometry, this.system.bgMaterial, buttons.length)

    await Util.whenLoaded(buttons);

    for (let buttonEl of buttons)
    {
      let component = buttonEl.components['icon-button']
      let fg = component.fg
      if (fg.material.map && this.data.mergeIcons)
      {
        if (fg.material.map.image.decode) await fg.material.map.image.decode()
      }
    }

    if (this.mesh) {
      this.mesh.parent.remove(this.mesh)
      if (this.mesh.dispose) this.mesh.dispose()
    }
    this.mesh = mesh

    mesh.position.set(0, 0, - this.system.depth / 2)
    let i = 0

    let canvas = this.iconCanvas || document.createElement('canvas')
    this.iconCanvas = canvas
    canvas.height = 32
    let ctx = canvas.getContext('2d')
    let usedCanvas = false
    let canUseCanvas = this.data.mergeIcons && !buttons.some(b => b.hasAttribute('position'))

    let spacing = 32 / this.system.width * (this.system.width + 0.05)
    canvas.width = spacing * buttons.length

    for (let buttonEl of buttons)
    {
      let component = buttonEl.components['icon-button']
      buttonEl.object3D.updateMatrix()
      mesh.setMatrixAt(i, buttonEl.object3D.matrix)
      mesh.setColorAt(i, component.bg.material.color)
      if (component.bg.parent) component.bg.parent.remove(component.bg)
      component.instanceManager = this
      this.componentToButton.set(component, i)

      let fg = component.fg
      if (fg.material.map && canUseCanvas)
      {
        ctx.drawImage(fg.material.map.image, i * spacing + spacing - 32, 0, 32, 32)
        usedCanvas = true

        if (!fg.material.cloned)
        {
          fg.material = fg.material.clone()
          fg.material.cloned = true
          // Can't remove. Need for raycaster
          fg.material.visible = false
        }
      }

      i++;
    }

    this.el.object3D.add(mesh)

    if (usedCanvas)
    {
      let fg = this.fg
      if (!fg) {
        fg = document.createElement('a-image')
        this.el.append(fg)
        fg.setAttribute('material', {
          src: canvas,
          color: '#FFF',
          fog: false,
          transparent: true,
          shader: this.system.data.iconShader,
          opacity: this.data === "" ? 0.0 : 1.0,
        })
      }
      fg.setAttribute('geometry', `width: ${(this.system.width + 0.05) * buttons.length}; height: ${this.system.width}`)
      fg.setAttribute('position', `${(this.system.width + 0.05) * (buttons.length - 1) / 2 - 0.025} 0 ${this.system.depth + 0.001}`)
      Util.whenLoaded(fg, () => {
        fg.components.material.material.toneMapped = false
        fg.components.material.material.needsUpdate = true
      })
      // fg.setAttribute('frame', '')
      this.fg = fg
    }

    this.mergeInProgress = false
  },
  setColor(component, color) {
    this.mesh.setColorAt(this.componentToButton.get(component), color)
    this.mesh.instanceColor.needsUpdate = true
  }
})

// A button which highlights when a target component property is set to a determined value.
// You can click the button to set the target property to that value.
// If the target property changes to a different value, the button will no longer be highlighted.
AFRAME.registerComponent('radio-button', {
  schema: {
    // The value the button will set the property to, and will be highlighted at
    value: {type: 'string'},
    // The element containing the target component property
    target: {type: 'selector'},
    // The component containing the target property
    component: {type: 'string'},
    // The property the radio button sets a value for
    property: {type: 'string'}
  },
  events: {
    click: function() {
      if (this.data.target)
      {
        if (this.data.property)
        {
          this.data.target.setAttribute(this.data.component, {[this.data.property]: this.data.value})
        }
        else
        {
          this.data.target.setAttribute(this.data.component, this.data.value)
        }
      }
      else if (this.data.system)
      {
        this.el.sceneEl.systems[this.data.system].data[this.data.property] = this.data.value
        this.setToggle(true)
      }
    }
  },
  update(oldData) {
    if (this.data.target !== oldData.target)
    {
      if (oldData.target)
      {
        oldData.target.removeEventListener('componentchanged', this.componentchangedlistener)
      }

      if (this.data.target)
      {
        this.componentchangedlistener = (e) => {
          if (e.detail.name === this.data.component)
          {
            this.setToggle(this.data.target.getAttribute(this.data.component)[this.data.property] === this.data.value, {update: false})
          }
        }
        this.data.target.addEventListener('componentchanged', this.componentchangedlistener)

        Util.whenLoaded([this.el, this.data.target], () => {
          this.setToggle(this.data.target.getAttribute(this.data.component)[this.data.property] === this.data.value, {update: false})
        })
      }
    }
  },
  setToggle(value) {
    this.data.toggled = value
    if (value)
    {
      this.el.addState(STATE_TOGGLED)
      this.el.components['icon-button'].updateStateColor()
    }
    else
    {
      this.el.removeState(STATE_TOGGLED)
    }
  }
})

AFRAME.registerComponent('icon-row-text', {
  dependencies: ['text'],
  schema: {default: "", type: 'string'},
  init() {
    this.el.setAttribute('text', `anchor: left; align: left; value: ${this.data}`)
    this.el.setAttribute('translate-text', '')
  },
  update() {
    this.el.setAttribute('text', 'value', this.data)
  }
})
