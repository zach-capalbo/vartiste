#version 100

precision mediump float;

uniform sampler2D u_input;
uniform vec3 u_color;
varying vec2 vUv;

vec3 invert(vec4 c) {
  return vec3(1.0 - c.r, 1.0 - c.g, 1.0 - c.b) * c.w;
}


void main() {
  vec4 color = texture2D(u_input, vUv);

  gl_FragColor = vec4(
     (length(u_color) > 0.5 ? u_color * color.xzy : u_color +  invert(color)) * color.w,
     color.w);
}
