#version 100

precision mediump float;

uniform float u_width;
uniform float u_height;
uniform sampler2D u_input;
uniform sampler2D u_source_1;
varying vec2 vUv;

void main() {
  gl_FragColor = vec4(vUv.x, vUv.y, 0.5, 1.0);
}
