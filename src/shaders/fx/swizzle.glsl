#version 100

precision mediump float;

uniform float u_width;
uniform float u_height;
uniform sampler2D u_input;
varying vec2 vUv;

void main() {
  vec4 color = texture2D(u_input, vUv);
  color.g = 1.0 - color.g;
  gl_FragColor = color;
}
