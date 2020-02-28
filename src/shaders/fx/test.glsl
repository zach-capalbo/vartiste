#version 100

precision mediump float;

uniform sampler2D u_input;
varying vec2 vUv;

void main() {
  vec4 color1 = texture2D(u_input, vUv);
  gl_FragColor = vec4(vUv.x, vUv.y, color1.z, color1[3]);
}
