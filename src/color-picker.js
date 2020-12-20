// Based on https://jsfiddle.net/gftruj/tLo2vh99/
const Color = require('color')
const {Undo} = require('./undo.js')
import {Util} from './util.js'

// Adds a colorwheel for picking colors for the [`paint-system`](#paint-system)
AFRAME.registerComponent("color-picker", {
  dependencies: ['material', 'geometry'],
  schema: {brightness: {type: 'float', default: 0.5}},
  init() {
    this.system = document.querySelector('a-scene').systems['paint-system']

    var vertexShader = require('./shaders/pass-through.vert')

    var fragmentShader = require('./shaders/color-wheel.glsl')

    var material = new THREE.ShaderMaterial({
      uniforms: {
        brightness: {
          type: 'f',
          value: this.data.brightness
        }
      },
      vertexShader: vertexShader,
      fragmentShader: fragmentShader
    });

    this.mesh = this.el.getObject3D('mesh');

    this.mesh.material = material;

		this.el.addEventListener("draw", (e)=>{
      let point = e.detail.intersection.uv
      point.x = point.x * 2 - 1
      point.y = point.y * 2 - 1

      var polarPosition = {
        r: Math.sqrt(point.x * point.x + point.y * point.y),
        theta: Math.PI + Math.atan2(point.y, point.x)
      };
      var angle = ((polarPosition.theta * (180 / Math.PI)) + 180) % 360;
      var h, s, l
      h = angle / 360;
      s = polarPosition.r;
      l = this.data.brightness;

      var color = Color({h: h * 360, s: s * 100,v:l * 100}).rgb().hex()
      this.handleColor(color)
    })

    this.el.setAttribute('action-tooltips', 'trigger: Select Color')
  },
  handleColor(color) {
    this.system.selectColor(color)
  },
  update(oldData) {
    this.mesh.material.uniforms.brightness.value = this.data.brightness
  }
})

// Picks the brightness for a [`color-wheel`](#color-wheel)
AFRAME.registerComponent("brightness-picker", {
  // The element with a `color-wheel` component to set the brightness on
  schema: {target: {type: 'selector'}},
  init() {
    this.system = document.querySelector('a-scene').systems['paint-system']

    var vertexShader = require('./shaders/pass-through.vert')

    var fragmentShader = require('./shaders/brightness-ramp.glsl')

    var material = new THREE.ShaderMaterial({
      vertexShader: vertexShader,
      fragmentShader: fragmentShader
    });

    this.mesh = this.el.getObject3D('mesh');

    this.mesh.material = material;

    this.el.setAttribute('action-tooltips', 'trigger: Change Brightness')

    this.el.addEventListener("draw", (e)=>{
      let point = e.detail.intersection.uv

      if (this.data.target)
      {
        this.data.target.setAttribute("color-picker", {brightness: point.y})

        let color = this.system.data.color
        this.system.selectColor(Color(color).value(100 * point.y).rgb().hex())
      }
      else
      {
        this.brightness = point.y
        this.el.emit('brightnesschanged', {brightness: this.brightness})
      }
    })
  }
})

// Provides a slider to pick the opacity for the [`paint-system`](#paint-system)
AFRAME.registerComponent("opacity-picker", {
  init() {
    this.system = document.querySelector('a-scene').systems['paint-system']

    var vertexShader = require('./shaders/pass-through.vert')

    var fragmentShader = require('./shaders/opacity-ramp.glsl')

    var material = new THREE.ShaderMaterial({
      vertexShader: vertexShader,
      fragmentShader: fragmentShader,
      transparent: true
    });

    this.mesh = this.el.getObject3D('mesh');
    this.mesh.material = material;

    let geometry = new THREE.Geometry()
    geometry.vertices.push(new THREE.Vector3(0,0.05,0.01))
    geometry.vertices.push(new THREE.Vector3(-0.05,0.2,0.01))
    geometry.vertices.push(new THREE.Vector3(0.05,0.2,0.01))
    geometry.faces.push(new THREE.Face3(0,1,2))
    this.indicator = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({color: 0xa87732, side: THREE.DoubleSide}))
    this.el.object3D.add(this.indicator)

    this.adjustIndicator(this.system.data.opacity)

    let edges = new THREE.EdgesGeometry( this.mesh.geometry );
    let edgeMaterial = new THREE.LineBasicMaterial( { color: 0xffffff, linewidth: 1 } );
    let edgeSegments = new THREE.LineSegments( edges, edgeMaterial );
    this.el.object3D.add( edgeSegments );

    if (!this.el.hasAttribute('action-tooltips'))
    {
      this.el.setAttribute('action-tooltips', 'trigger: Select Opacity')
    }

    this.el.addEventListener("click", (e)=> {
      if (this.layer && !this.wasDrawing) {
        let oldOpacity = this.layer.oldOpacity
        Undo.push(() => {
          this.layer.opacity = oldOpacity
          this.layer.touch()
        })
      }
      this.handleClick(e)
    })
    this.el.addEventListener("draw", (e)=>{
      if (this.layer && !this.wasDrawing)
      {
        this.wasDrawing  = true
        let oldOpacity = this.layer.opacity
        Undo.push(() => {
          this.layer.opacity = oldOpacity
          this.adjustIndicator(oldOpacity)
        })
        e.detail.sourceEl.addEventListener('enddrawing', () => {this.wasDrawing = false}, {once: true})
      }
      this.handleClick(e)
    })

    this.el.sceneEl.addEventListener('opacitychanged', (e) => {
      if (this.layer) return
      this.adjustIndicator(e.detail.opacity)
    })
  },
  adjustIndicator(opacity) {
    let width = this.mesh.geometry.metadata.parameters.width
    let x = Math.pow(opacity, 1/2.2)
    this.indicator.position.x = x * width - width / 2
  },
  handleClick(e) {
    let point = e.detail.intersection.uv

    let opacity = Math.pow(point.x, 2.2)

    if (opacity > 0.95) opacity = 1

    this.adjustIndicator(opacity)

    if (this.layer)
    {
      this.layer.opacity = opacity
      this.layer.touch()
    }
    else
    {
      this.system.selectOpacity(opacity)
    }
  }
})

// Provides a little display for the current color in the [`paint-system`](#paint-system)
AFRAME.registerComponent("show-current-color", {
  init() {
    this.system = this.el.sceneEl.systems['paint-system']
    this.el.setAttribute('material', {shader: 'flat', transparent: true, color: this.system.data.color})
    this.onColorChanged = (e) => {
      this.el.setAttribute('material', {color: e.detail.color})
    }
    this.el.sceneEl.addEventListener('colorchanged', this.onColorChanged)
  },
  remove() {
    this.el.sceneEl.removeEventListener('colorchanged', this.onColorChanged)
  }
})

// Provides a little display for the current brush in the [`paint-system`](#paint-system)
AFRAME.registerComponent("show-current-brush", {
  init() {
    this.system = this.el.sceneEl.systems['paint-system']
    this.baseWidth = this.el.getAttribute('width')
    this.el.setAttribute('material', {shader: 'flat', transparent: true, color: '#fff'})
    let brushChanged = (brush) => {
      this.el.setAttribute('material', {src: brush.previewSrc})
      this.el.setAttribute('height', this.baseWidth / brush.width * brush.height)
    }
    this.el.sceneEl.addEventListener('brushchanged', e => brushChanged(e.detail.brush))
    brushChanged(this.system.brush)
  },
})

// Provides a preset-color picker for the [`paint-system`](#paint-system)
AFRAME.registerComponent("palette", {
  schema: {
    colors: {type: 'array'},
    maxCount: {default: 0},
    allowDuplicates: {default: true},
  },
  init() {
    this.el.addEventListener('click', (e) => {
      if (e.target.hasAttribute('click-action')) {
        this[e.target.getAttribute('click-action')](e)
        return
      }
      if (!e.target.hasAttribute("button-style")) return

      let system = this.el.sceneEl.systems['paint-system']
      // system.selectOpacity(1.0)
      system.selectColor(e.target.getAttribute('button-style').color)
    })
  },
  update(oldData) {
    this.el.querySelectorAll('.custom').forEach(e => this.el.removeChild(e))

    for (let color of this.data.colors)
    {
      this.addButton(color)
    }
  },
  addToPalette(e) {
    let system = this.el.sceneEl.systems['paint-system']

    if (!this.data.allowDuplicates && this.data.colors.indexOf(system.data.color) >= 0) return

    if (this.data.maxCount <= 0 || this.data.colors.length < this.data.maxCount)
    {
      this.addButton(system.data.color)
      this.data.colors.push(system.data.color)
      return
    }

    this.data.colors.push(system.data.color)
    this.data.colors.splice(0, 1)

    let buttons = this.el.querySelectorAll('*[icon-button]')
    for (let i = 0; i < this.data.colors.length; ++i)
    {
      buttons[i].setAttribute('button-style', 'color', this.data.colors[i])
      buttons[i].components['icon-button'].setColor(this.data.colors[i])
    }
  },
  addButton(color) {
    let newButton = document.createElement('a-entity')
    newButton.setAttribute('icon-button', "")
    newButton.setAttribute('button-style', `color: ${color}`)
    newButton.setAttribute('tooltip', color)
    newButton.classList.add('custom')
    this.el.append(newButton)
  }
})

AFRAME.registerComponent('color-selector-lever', {
  dependencies: ['lever'],
  schema: {
    component: {type: 'string'}
  },
  events: {
    anglechanged: function(e) {
      this.isDragging = true
      this.updateColorValue(e.detail.value)
      this.isDragging = false
    },
    editfinished: function(e) {
      this.updateColorValue(THREE.MathUtils.clamp(parseInt(e.detail.value), 0, this.el.components.lever.data.valueRange.y))
    }
  },
  init() {
    this.system = this.el.sceneEl.systems['paint-system']
    this.el.sceneEl.addEventListener('colorchanged', this.onColorChanged.bind(this))
    if (!this.el.hasAttribute('tooltip'))
    {
      this.el.setAttribute('tooltip', Util.titleCase(this.data.component))
    }
    Util.whenLoaded(this.el, () => {
      this.onColorChanged({color: this.system.data.color})
      this.el.querySelector('.label').setAttribute('text', 'value', this.el.getAttribute('tooltip'))
      this.valueEl = this.el.querySelector('.value')
    })
  },
  updateColorValue(value)
  {
    let color = this.system.brush.ccolor || Color(this.system.data.color)
    color = color[this.data.component](value)
    console.log("Levering color", color.rgb().hex(), value)
    this.el.sceneEl.systems['paint-system'].selectColor(color.rgb().hex())
    if ('ccolor' in this.system.brush)
    {
      this.system.brush.ccolor = color
    }
  },
  onColorChanged(e) {
    let value
    if (this.system.brush.ccolor)
    {
      value = this.system.brush.ccolor[this.data.component]()
    }
    else
    {
      value = Color(e.detail.color)[this.data.component]()
    }

    if (!this.isDragging) this.el.components['lever'].setValue(value)
    this.el.querySelector('.value').setAttribute('text', 'value', `${Math.round(value)}`)
  }
})
