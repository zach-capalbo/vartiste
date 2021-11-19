#version 100

precision mediump float;

uniform sampler2D u_input;
uniform sampler2D u_base;
varying vec2 vUv;


void main() {
  vec3 vec = texture2D(u_input, vUv).xyz;
  vec3 base = texture2D(u_base, vUv).xyz;
  vec.x = vec.x + base.x - 1.0;
  vec.y = vec.y + base.y - 1.0;
  vec.x = clamp(vec.x + 0.5, 0.0, 1.0);
  vec.y = clamp(vec.y + 0.5, 0.0, 1.0);
  vec.z = max(vec.z, base.z);

  gl_FragColor = vec4(vec, 1.0);
}
