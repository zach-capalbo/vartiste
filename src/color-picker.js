// Based on https://jsfiddle.net/gftruj/tLo2vh99/

function hsb2rgb(hsb) {
    var rgb = {};
    console.log("hsb", hsb)
    var h = Math.round(hsb.h * 360);
    var s = Math.round(hsb.s * 255);
    var v = Math.round(hsb.b * 255);
    if(s === 0) {
        rgb.r = rgb.g = rgb.b = v;
    } else {
        var t1 = v;
        var t2 = (255 - s) * v / 255;
        var t3 = (t1 - t2) * (h % 60) / 60;
        if( h === 360 ) h = 0;
        if( h < 60 ) { rgb.r = t1; rgb.b = t2; rgb.g = t2 + t3; }
        else if( h < 120 ) {rgb.g = t1; rgb.b = t2; rgb.r = t1 - t3; }
        else if( h < 180 ) {rgb.g = t1; rgb.r = t2; rgb.b = t2 + t3; }
        else if( h < 240 ) {rgb.b = t1; rgb.r = t2; rgb.g = t1 - t3; }
        else if( h < 300 ) {rgb.b = t1; rgb.g = t2; rgb.r = t2 + t3; }
        else if( h < 360 ) {rgb.r = t1; rgb.g = t2; rgb.b = t1 - t3; }
        else { rgb.r = 0; rgb.g = 0; rgb.b = 0; }
    }
    return {
        r: Math.round(rgb.r),
        g: Math.round(rgb.g),
        b: Math.round(rgb.b)
    };
}

function hsbToHex(h,s,bb)
{
  let {r,g,b} = hsb2rgb({h,s,b:bb})
  const toHex = x => {
    const hex = Math.round(x).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };
  console.log("rgb", r,g,b)
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

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
      var color = hsbToHex(h, s,l)
      this.handleColor(color)
    })
  },
  hslToHex(h,s,l) {
        let r, g, b;
        if (s === 0) {
          r = g = b = l; // achromatic
        } else {
          const hue2rgb = (p, q, t) => {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1 / 6) return p + (q - p) * 6 * t;
            if (t < 1 / 2) return q;
            if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
            return p;
          };
          const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
          const p = 2 * l - q;
          r = hue2rgb(p, q, h + 1 / 3);
          g = hue2rgb(p, q, h);
          b = hue2rgb(p, q, h - 1 / 3);
        }
        const toHex = x => {
          const hex = Math.round(x * 255).toString(16);
          return hex.length === 1 ? '0' + hex : hex;
        };
        return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
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
    })
  }
})

AFRAME.registerComponent("show-current-color", {
  init() {
    this.el.setAttribute('color', document.querySelector('a-scene').systems['paint-system'].data.color)
    this.el.sceneEl.addEventListener('colorchanged', (e) => {
      this.el.setAttribute('color', e.detail.color)
    })
  }
})
