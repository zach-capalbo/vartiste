// Based on https://jsfiddle.net/gftruj/tLo2vh99/
const Color = require('color')

AFRAME.registerComponent("color-picker", {
  schema: {brightness: {type: 'float', default: 0.5}},
  init() {
    this.system = document.querySelector('a-scene').systems['paint-system']

    var vertexShader = '\
    varying vec2 vUv;\
    void main() {\
      vUv = uv;\
      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);\
      gl_Position = projectionMatrix * mvPosition;\
    }\
    ';

    var fragmentShader = '\
    #define M_PI2 6.28318530718\n \
    uniform float brightness;\
    varying vec2 vUv;\
    vec3 hsb2rgb(in vec3 c){\
        vec3 rgb = clamp(abs(mod(c.x * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, \
                         0.0, \
                         1.0 );\
        rgb = rgb * rgb * (3.0 - 2.0 * rgb);\
        return c.z * mix( vec3(1.0), rgb, c.y);\
    }\
    \
    void main() {\
      vec2 toCenter = vec2(0.5) - vUv;\
      float angle = atan(toCenter.y, toCenter.x);\
      float radius = length(toCenter) * 2.0;\
      vec3 color = hsb2rgb(vec3((angle / M_PI2) + 0.5, radius, brightness));\
      gl_FragColor = vec4(color, 1.0);\
    }\
    ';

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

    var vertexShader = '\
    varying vec2 vUv;\
    void main() {\
      vUv = uv;\
      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);\
      gl_Position = projectionMatrix * mvPosition;\
    }\
    ';

    var fragmentShader = '\
    varying vec2 vUv;\
    \
    void main() {\
      vec3 color = vec3(vUv.y); \
      gl_FragColor = vec4(color, 1.0);\
    }\
    ';

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

AFRAME.registerComponent("show-current-color", {
  init() {
    this.el.setAttribute('material', {shader: 'flat', color: document.querySelector('a-scene').systems['paint-system'].data.color})
    this.el.sceneEl.addEventListener('colorchanged', (e) => {
      this.el.setAttribute('material', {color: e.detail.color})
    })
  }
})
