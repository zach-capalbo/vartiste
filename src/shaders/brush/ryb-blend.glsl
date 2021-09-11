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

float min(float a, float b, float c) { return min(min(a, b), c); }
float max(float a, float b, float c) { return max(max(a, b), c); }

vec3 rgb2ryb(vec3 rgb)
{
  float white = min(rgb.r, rgb.g, rgb.b);
  vec3 noWhite = vec3(rgb.r - white, rgb.g - white, rgb.b - white);

  if (max(noWhite.r, noWhite.g, noWhite.b) < 0.001)
  {
    return vec3(1.0 - rgb.r, 1.0 - rgb.g, 1.0 - rgb.b);
  }

  vec3 ryb = vec3(
    noWhite.r - min(noWhite.r, noWhite.g),
    (noWhite.g + min(noWhite.r, noWhite.g)) / 2.0,
    (noWhite.b + noWhite.g - min(noWhite.r, noWhite.g)) / 2.0
  );

  float n = max(ryb.r, ryb.g, ryb.b) / max(noWhite.r, noWhite.g, noWhite.b);

  n = n < 0.0001 ? 1.0 : n;

  ryb /= n;
  float black = min(1.0 - rgb.r, 1.0 - rgb.g, 1.0 - rgb.b);
  return vec3(
    clamp(ryb.r + black, 0.0, 1.0),
    clamp(ryb.g + black, 0.0, 1.0),
    clamp(ryb.b + black, 0.0, 1.0)
    );
}

vec3 ryb2rgb(vec3 ryb)
{
  float white = min(ryb.r, ryb.g, ryb.b);
  vec3 noWhite = vec3(ryb.r - white, ryb.g - white, ryb.b - white);

  if (max(noWhite.r, noWhite.g, noWhite.b) < 0.01)
  {
    return vec3(1.0 - ryb.r, 1.0 - ryb.g, 1.0 - ryb.b);
  }

  vec3 rgb = vec3(
    noWhite.r + noWhite.g - min(noWhite.g, noWhite.b),
    noWhite.g + 2.0 * min(noWhite.g, noWhite.b),
    2.0 * (noWhite.b - min(noWhite.g, noWhite.b))
    );

  float n = max(rgb.r, rgb.g, rgb.b) / max(noWhite.r, noWhite.g, noWhite.b);

  n = n < 0.001 ? 1.0 : n;

  rgb /= n;

  float black = min(1.0 - ryb.r, 1.0 - ryb.g, 1.0 - ryb.b);

  return vec3(
    clamp(rgb.r + black, 0.0, 1.0),
    clamp(rgb.g + black, 0.0, 1.0),
    clamp(rgb.b + black, 0.0, 1.0)
    );
}

vec3 mixRYB(vec3 base, vec3 paint, float opacity)
{
  vec3 baseRYB = rgb2ryb(base);
  vec3 paintRYB = rgb2ryb(paint);

  vec3 mixed = mix(baseRYB, paintRYB, opacity);

  /* return ryb2rgb(baseRYB); */
  /* return mixed; */
  return ryb2rgb(mixed);
}

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

  float resOpacity = clamp(opacity  + canvasBaseColor.a * (1.0 - opacity), 0.0, 1.0);

  vec3 resColor = mixRYB( canvasBaseColor.xyz,
                      u_color ,
                      opacity );

  /* resColor[0] = remix0(resColor, canvasBaseColor, opacity, brushUv);
  resColor[1] = remix1(resColor, canvasBaseColor, opacity, brushUv);
  resColor[2] = remix2(resColor, canvasBaseColor, opacity, brushUv); */

  /* float resOpacity = mix(canvasBaseColor[3], 1.0, opacity); */
  gl_FragColor = opacity < 1.0 / 256.0 ? canvasBaseColor  : vec4(resColor, resOpacity);
}
