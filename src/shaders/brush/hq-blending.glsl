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



float remix0(vec3 resColor, vec4 canvasBaseColor, float opacity, vec2 brushUv) {
  const int channel = 0;
  if (opacity < 1.0/256.0) return resColor[channel];
  if (resColor[channel] - canvasBaseColor[channel] > 5.0/256.0) return resColor[channel];
  return u_color[channel];
  if (u_color[channel] > canvasBaseColor[channel]) return resColor[channel] + 4.0 * (rand(brushUv) - 0.5) / 256.0;
  return resColor[channel] - 2.0 * (rand(brushUv) - 0.5) / 256.0;
}

float remix1(vec3 resColor, vec4 canvasBaseColor, float opacity, vec2 brushUv) {
  const int channel = 1;
  if (opacity < 1.0/256.0) return resColor[channel];
  if (resColor[channel] - canvasBaseColor[channel] > 5.0/256.0) return resColor[channel];
  return u_color[channel];
  if (u_color[channel] > canvasBaseColor[channel]) return resColor[channel] + 4.0 * (rand(brushUv) - 0.5) / 256.0;
  return resColor[channel] - 4.0 * (rand(brushUv) - 0.5) / 256.0;
}

float remix2(vec3 resColor, vec4 canvasBaseColor, float opacity, vec2 brushUv) {
  const int channel = 2;
  if (opacity < 1.0/256.0) return resColor[channel];
  if (resColor[channel] - canvasBaseColor[channel] > 5.0/256.0) return resColor[channel];
  return u_color[channel];
  if (u_color[channel] > canvasBaseColor[channel]) return resColor[channel] + 4.0 * (rand(brushUv) - 0.5) / 256.0;
  return resColor[channel] - 4.0 * (rand(brushUv) - 0.5) / 256.0;
}

void main() {
  vec4 canvasBaseColor = texture2D(u_input, vUv);
  /* vec2 brushUv = vec2(vUv.x + u_x / u_width, vUv.y + u_y / u_height); */
  vec2 brushUv = calcBrushUv(u_x, u_y);


  vec4 brushColor = texture2D(u_brush, brushUv);
  vec4 brushUvLast = texture2D(u_brush, calcBrushUv(u_x - 1.0, u_y - 1.0));

  float opacity = brushColor[3];
  opacity = opacity * u_opacity;
  opacity = opacity < 0.000001 ? -99.0 : opacity;
  opacity += 4.0 * (rand(brushUv) - 0.5) / 256.0

  opacity = (brushUv.x > 1.0 || brushUv.y > 1.0) ? 0.0 : opacity;
  opacity = (brushUv.x < 0.0 || brushUv.y < 0.0) ? 0.0 : opacity;

  opacity = clamp(opacity, 0.0, 1.0);

  vec3 resColor = mix( canvasBaseColor.xyz,
                      u_color ,
                      opacity );

  /* resColor[0] = remix0(resColor, canvasBaseColor, opacity, brushUv);
  resColor[1] = remix1(resColor, canvasBaseColor, opacity, brushUv);
  resColor[2] = remix2(resColor, canvasBaseColor, opacity, brushUv); */

  float resOpacity = mix(canvasBaseColor[3], 1.0, opacity);
  gl_FragColor = opacity < 1.0 / 256.0 ? canvasBaseColor  : vec4(resColor, resOpacity);
}
