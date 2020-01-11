// Based on https://jsfiddle.net/gftruj/tLo2vh99/
const Color = require('color')

AFRAME.registerComponent("color-picker", {
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
      console.log(this.data.brightness, l)
      var color = Color({h: h * 360, s: s * 100,v:l * 100}).rgb().hex()
      this.handleColor(color)
    })
  },
  handleColor(color) {
    this.system.selectColor(color)
  },
  update(oldData) {
    this.mesh.material.uniforms.brightness.value = this.data.brightness
  }
})

AFRAME.registerComponent("brightness-picker", {
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

    this.el.addEventListener("draw", (e)=>{
      let point = e.detail.intersection.uv
      this.data.target.setAttribute("color-picker", {brightness: point.y})

      let color = this.system.data.color
      this.system.selectColor(Color(color).value(100 * point.y).rgb().hex())
    })
  }
})

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

    this.el.addEventListener("click", (e)=>this.handleClick(e))
    this.el.addEventListener("draw", (e)=>this.handleClick(e))

    this.el.sceneEl.addEventListener('opacitychanged', (e) => {
      if (this.layer) return
      this.adjustIndicator(e.detail.opacity)
    })
  },
  adjustIndicator(opacity) {
    let width = this.mesh.geometry.metadata.parameters.width
    this.indicator.position.x = opacity * width - width / 2
  },
  handleClick(e) {
    let point = e.detail.intersection.uv

    this.adjustIndicator(point.x)

    if (this.layer)
    {
      this.layer.opacity = point.x

      console.log("Updating layer opacity", this.layer, this.layer.opacity)
    }
    else
    {
      this.system.selectOpacity(point.x)
    }
  }
})

AFRAME.registerComponent("show-current-color", {
  init() {
    this.system = this.el.sceneEl.systems['paint-system']
    this.el.setAttribute('material', {shader: 'flat', transparent: true, color: this.system.data.color, opacity: this.system.data.opacity})
    this.el.sceneEl.addEventListener('colorchanged', (e) => {
      this.el.setAttribute('material', {color: e.detail.color})
    })
    this.el.sceneEl.addEventListener('opacitychanged', (e) => {
      //this.el.setAttribute('material', {opacity: e.detail.opacity})
    })
  }
})

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

AFRAME.registerComponent("palette", {
  init() {
    this.el.addEventListener('click', (e) => {
      if (!e.target.hasAttribute("button-style")) return

      let system = this.el.sceneEl.systems['paint-system']
      system.selectOpacity(1.0)
      system.selectColor(e.target.getAttribute('button-style').color)
    })
  }
})
