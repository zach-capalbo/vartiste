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

void main() {

  vec2 brushUv = calcBrushUv(u_x, u_y);
  vec4 brushColor = texture2D(u_brush, brushUv);
  vec4 nudgeColor = texture2D(u_input, vUv - vec2(cos(u_brush_rotation) / u_width, sin(u_brush_rotation) / u_height));
  vec2 nudgeBrushUv = calcBrushUv(u_x - cos(u_brush_rotation) / u_width, u_y - sin(u_brush_rotation) / u_height);
  vec4 nudgeBrushColor = texture2D(u_brush, nudgeBrushUv);

  float opacity = brushColor[3];
  opacity = (brushUv.x > 1.0 || brushUv.y > 1.0) ? 0.0 : opacity;
  opacity = (brushUv.x < 0.0 || brushUv.y < 0.0) ? 0.0 : opacity;
  opacity = clamp(opacity, 0.0, 1.0);

  float nudgeAmmount = nudgeBrushColor[3];
  nudgeAmmount = (nudgeBrushUv.x > 1.0 || nudgeBrushUv.y > 1.0) ? 0.0 : nudgeAmmount;
  nudgeAmmount = (nudgeBrushUv.x < 0.0 || nudgeBrushUv.y < 0.0) ? 0.0 : nudgeAmmount;
  nudgeAmmount = clamp(nudgeAmmount, 0.0, 1.0);

  vec4 currentColor = texture2D(u_input, vUv - nudgeAmmount * vec2(cos(u_brush_rotation) / u_width, sin(u_brush_rotation) / u_height) );
  vec4 upColor = texture2D(u_input, vUv + vec2(0, -1) / u_height);
  vec4 downColor = texture2D(u_input, vUv + vec2(0, 1) / u_height);

  /* currentColor = mix(currentColor, nudgeColor, nudgeAmmount); */
  /* currentColor = mix(currentColor, brushColor, opacity); */

  float resistance = downColor[3];
  /* float stickPct = downColor[3] + currentColor[3]; */

  /* stickPct = (vUv.y >= (u_height - 10.0) / u_height) ? 1.0 : stickPct; */

  resistance = (vUv.y >= (u_height - 1.0) / u_height) ? 1.0 : resistance;

  /* vec4 res = vec4(currentColor.xyz * (1.0 - abs(stickPct - currentColor[3])), stickPct); */
  vec4 res = currentColor;
  res = mix(currentColor, upColor, 1.0 - resistance);
  /* res = upColor[3] > 0.01 ? mix(res, upColor, 1.0 - res[3] / upColor[3]) : res; */

  /* float correction = max(0.0, 1.0 - (currentColor.a - res.a)); */
  /* res = vec4(res.xyz * correction, res.a); */
  res = mix(res, brushColor, opacity);
  res = mix(currentColor, res, u_opacity);
  gl_FragColor = res;
}
