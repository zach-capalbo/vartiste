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
  schema: {target: {type: 'selector'}},
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

    this.el.addEventListener("draw", (e)=>{
      let point = e.detail.intersection.uv
      // this.data.target.setAttribute("color-picker", {brightness: point.y})

      this.system.selectOpacity(point.x)

      // let color = this.system.data.color
      // this.system.selectColor(Color(color).value(100 * point.y).rgb().hex())
    })
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
      this.el.setAttribute('material', {opacity: e.detail.opacity})
    })
  }
})
