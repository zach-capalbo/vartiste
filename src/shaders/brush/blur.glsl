#version 100

precision mediump float;

uniform sampler2D u_input;
uniform float u_width;
uniform float u_height;
uniform sampler2D u_brush;
uniform float u_brush_width;
uniform float u_brush_height;
uniform float u_x;
uniform float u_y;
uniform float u_opacity;
uniform vec3 u_color;
uniform float u_t;
varying vec2 vUv;

#pragma loader: import {calcBrushUv, rand} from './util.glsl'

vec4 blur(vec2 direction) {
  vec2 off1 = vec2(1.3846153846) * direction;
  vec2 off2 = vec2(3.2307692308) * direction;
  vec4 color1 = vec4(0.0);
  vec2 resolution = vec2(u_width / 2.0, u_height / 2.0);
  color1 += texture2D(u_input, vUv) * 0.2270270270;
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

  vec4 canvasBaseColor = texture2D(u_input, vUv);
  vec2 brushUv = calcBrushUv(u_x, u_y);
  vec4 brushColor = texture2D(u_brush, brushUv);

  float opacity = brushColor[3];
  opacity = opacity * u_opacity;
  opacity = opacity < 0.000001 ? -99.0 : opacity;
  opacity += 4.0 * (rand(brushUv) - 0.5) / 256.0

  opacity = (brushUv.x > 1.0 || brushUv.y > 1.0) ? 0.0 : opacity;
  opacity = (brushUv.x < 0.0 || brushUv.y < 0.0) ? 0.0 : opacity;

  opacity = clamp(opacity, 0.0, 1.0);

  vec4 resColor = mix( canvasBaseColor,
                      color ,
                      opacity );

  gl_FragColor = resColor;
}
