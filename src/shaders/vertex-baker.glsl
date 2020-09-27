#version 100

precision mediump float;

uniform sampler2D u_input;
varying vec4 vColor;

void main() {
  gl_FragColor = vColor;
}
