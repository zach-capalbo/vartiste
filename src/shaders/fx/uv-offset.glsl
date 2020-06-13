#version 100

precision mediump float;

uniform float u_width;
uniform float u_height;
uniform sampler2D u_input;
uniform sampler2D u_source_1;
varying vec2 vUv;

void main() {
  vec4 offsetSample = texture2D(u_source_1, vec2(vUv.x, vUv.y));
  float xOffset = offsetSample.x * 2.0;
  xOffset = xOffset > 1.0 ? - (xOffset - 1.0) : xOffset;
  float yOffset = offsetSample.y * 2.0;
  yOffset = yOffset > 1.0 ? - (yOffset - 1.0) : yOffset;
  gl_FragColor = texture2D(u_input, vec2(vUv.x + xOffset, vUv.y + yOffset));
}
