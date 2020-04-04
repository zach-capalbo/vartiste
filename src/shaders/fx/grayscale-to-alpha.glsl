#version 100

precision mediump float;

uniform float u_width;
uniform float u_height;
uniform sampler2D u_input;
varying vec2 vUv;

void main() {
  vec4 color = texture2D(u_input, vec2(vUv.x, vUv.y));
  gl_FragColor = vec4(1.0, 1.0, 1.0, dot(color.xyz, vec3(1)) / 3.0);
}
