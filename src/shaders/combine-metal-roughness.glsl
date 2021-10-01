#version 100
precision mediump float;
uniform sampler2D u_input;
uniform sampler2D u_roughness;
varying vec2 vUv;

#define u_metalness u_input

void main() {
  vec4 metalness = texture2D(u_metalness, vUv);
  vec4 roughness = texture2D(u_roughness, vUv);

  gl_FragColor = vec4(1.0, roughness.g, metalness.b, 1.0);
}
