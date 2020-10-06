#version 100

precision mediump float;

uniform sampler2D u_input;
uniform vec3 u_center;
uniform vec4 u_color;
uniform float u_size;
varying vec3 vPosition;
varying vec2 vUv;

void main() {
  vec4 base = texture2D(u_input, vUv);
  float d = 1.0 - clamp(distance(u_center, vPosition) / u_size, 0.0, 1.0);
  /* float d = distance(u_center, vPosition) > u_size ? 0.0 : 1.0; */

  d = d * u_color.a;
  gl_FragColor = mix(base, vec4(u_color.xyz * d, d), d);
  /* gl_FragColor = vec4((vPosition.xyz + 40.0)/ 80.0, 1.0); */
}
