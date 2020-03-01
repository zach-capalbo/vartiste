#version 100

precision mediump float;

uniform float u_width;
uniform float u_height;
uniform sampler2D u_input;
varying vec2 vUv;

#define image u_input
#define uv vUv

vec4 blur(vec2 direction) {
  vec2 off1 = vec2(1.3846153846) * direction;
  vec2 off2 = vec2(3.2307692308) * direction;
  vec4 color1 = vec4(0.0);
  vec2 resolution = vec2(u_width / 2.0, u_height / 2.0);
  color1 += texture2D(image, uv) * 0.2270270270;
  color1 += texture2D(image, uv + (off1 / resolution)) * 0.3162162162;
  color1 += texture2D(image, uv - (off1 / resolution)) * 0.3162162162;
  color1 += texture2D(image, uv + (off2 / resolution)) * 0.0702702703;
  color1 += texture2D(image, uv - (off2 / resolution)) * 0.0702702703;
  return color1;
}

void main() {
  vec4 color = blur(vec2(1.0, 0.0)) + blur(vec2(0.0, -1.0)) + blur(vec2(1.0, -1.0)) + blur(vec2(1.0, 1.0));
  color /= 4.0;
  color.xyz = color.xyz * color[3];
  gl_FragColor = color;
}
