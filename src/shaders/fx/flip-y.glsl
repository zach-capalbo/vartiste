#version 100

precision mediump float;

uniform float u_width;
uniform float u_height;
uniform sampler2D u_input;
varying vec2 vUv;

void main() {
  gl_FragColor = texture2D(u_input, vec2(vUv.x, 1.0 - vUv.y));
}
