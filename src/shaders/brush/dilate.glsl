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

vec4 pick(vec2 direction) {
  vec2 uv = vUv + direction * vec2(2.0 / u_width, 2.0 / u_height);
  return texture2D(u_input, uv);
}

vec4 maxByAlpha(vec4 c1, vec4 c2, vec4 c3, vec4 c4, vec4 c5)
{
  float maxA = c1.a;
  maxA = max(maxA, c2.a);
  maxA = max(maxA, c3.a);
  maxA = max(maxA, c4.a);
  maxA = max(maxA, c5.a);
  return (maxA == c1.a ? c1 : (maxA == c2.a ? c2 : (maxA == c3.a ? c3 : (maxA == c4.a ? c4 : c5))));
}

void main() {
  vec4 color = maxByAlpha(pick(vec2(1.0, 0.0)), pick(vec2(0.0, -1.0)), pick(vec2(-1.0, 0.0)), pick(vec2(0.0, 1.0)), pick(vec2(0.0, 0.0)));
  gl_FragColor = mixByBrush(color);
}
