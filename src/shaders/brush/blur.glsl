#version 100

precision mediump float;

uniform sampler2D u_input;
uniform float u_width;
uniform float u_height;
uniform sampler2D u_brush;
uniform float u_brush_width;
uniform float u_brush_height;
uniform float u_brush_rotation;
uniform float u_x;
uniform float u_y;
uniform float u_opacity;
uniform vec3 u_color;
uniform float u_t;
varying vec2 vUv;

#pragma loader: import {calcBrushUv, rand} from './util.glsl'
#pragma loader: import {mixByBrush} from './util.glsl'

vec4 scatter() {
  vec2 uv = vec2(vUv.x + (rand(vUv) - 0.5) * u_brush_width / u_width * 0.5,
                 vUv.y + (rand(vUv * 7.414556064744165) - 0.5) * u_brush_height / u_height * 0.5
                 );
  return texture2D(u_input, uv);
}

vec4 blur(vec2 direction) {
  vec2 off1 = vec2(1.3846153846) * direction;
  vec2 off2 = vec2(3.2307692308) * direction;
  vec4 color1 = vec4(0.0);
  vec2 resolution = vec2(u_width / 2.0, u_height / 2.0);
  /* color1 += texture2D(u_input, vUv) * 0.2270270270; */
  color1 += scatter() * 0.2270270270;
  color1 += texture2D(u_input, vUv + (off1 / resolution)) * 0.3162162162;
  color1 += texture2D(u_input, vUv - (off1 / resolution)) * 0.3162162162;
  color1 += texture2D(u_input, vUv + (off2 / resolution)) * 0.0702702703;
  color1 += texture2D(u_input, vUv - (off2 / resolution)) * 0.0702702703;
  return color1;
}

void main() {
  vec4 color = blur(vec2(1.0, 0.0)) + blur(vec2(0.0, -1.0)) + blur(vec2(1.0, -1.0)) + blur(vec2(1.0, 1.0));
  color += 0.5 * (blur(vec2(2.0, 0.0)) + blur(vec2(0.0, -2.0)) + blur(vec2(2.0, -2.0)) + blur(vec2(2.0, 2.0)))
  color /= 6.0;

  gl_FragColor = mixByBrush(color);
}
