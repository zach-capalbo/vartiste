#version 100

precision mediump float;

uniform sampler2D u_input;
uniform vec3 u_color;
varying vec2 vUv;
varying float vOpacity;

vec3 invert(vec4 c) {
  return vec3(1.0 - c.r, 1.0 - c.g, 1.0 - c.b) * c.w;
}


void main() {
  vec4 color = texture2D(u_input, vUv);

  // I think this one is more correct
  gl_FragColor = vec4(
     (length(u_color) > 0.5 ? vec3(u_color.r * color.r * color.w, u_color.g * color.g * color.w, u_color.b * color.b * color.w)
                            : u_color +  invert(color)) * color.w,
     color.w);

  /* gl_FragColor = vec4(
     (length(u_color) > 0.5 ? u_color * color.xzy : u_color +  invert(color)) * color.w * vOpacity,
     color.w * vOpacity); */
}
