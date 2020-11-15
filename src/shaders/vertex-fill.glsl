#version 100

precision mediump float;

uniform sampler2D u_input;
uniform vec3 u_color;

void main() {
  gl_FragColor = vec4(u_color, 1.0);
}
