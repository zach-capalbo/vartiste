#version 100

precision mediump float;

uniform sampler2D u_input;
uniform vec3 u_color;
varying vec2 vUv;

void main() {
  vec4 color = texture2D(u_input, vUv);
  gl_FragColor = vec4(u_color * color.w, color.w);
}
