#version 100

precision mediump float;

uniform float u_width;
uniform float u_height;
uniform sampler2D u_input;
varying vec2 vUv;

vec3 sampleGradient(float alpha)
{
  return vec3(0,0,0);
}

void main() {
  vec4 color = texture2D(u_input, vec2(vUv.x, vUv.y));
  gl_FragColor = vec4(sampleGradient(color[3]), color[3]);
}
