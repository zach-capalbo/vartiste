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

vec3 oklab_mix( vec3 colA, vec3 colB, float h )
{
    // https://bottosson.github.io/posts/oklab
    const mat3 kCONEtoLMS = mat3(
         0.4121656120,  0.2118591070,  0.0883097947,
         0.5362752080,  0.6807189584,  0.2818474174,
         0.0514575653,  0.1074065790,  0.6302613616);
    const mat3 kLMStoCONE = mat3(
         4.0767245293, -1.2681437731, -0.0041119885,
        -3.3072168827,  2.6093323231, -0.7034763098,
         0.2307590544, -0.3411344290,  1.7068625689);

    // rgb to cone (arg of pow can't be negative)
    vec3 lmsA = pow( kCONEtoLMS*colA, vec3(1.0/3.0) );


    vec3 lmsB = pow( kCONEtoLMS*colB, vec3(1.0/3.0) );
    // lerp
    vec3 lms = mix( lmsA, lmsB, h );
    // gain in the middle (no oaklab anymore, but looks better?)
    /* lms *= 1.0+0.2*h*(1.0-h); */
    // cone to rgb
    return kLMStoCONE*(lms*lms*lms);
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
  /* vec4 brushUvLast = texture2D(u_brush, calcBrushUv(u_x - 1.0, u_y - 1.0)); */

  float opacity = brushColor[3];
  opacity = opacity * u_opacity;
  opacity = opacity < 1.0 / 255.0 ? -99.0 : opacity;
  opacity += 4.0 * (rand(brushUv) - 0.5) / 255.0

  opacity = (brushUv.x > 1.0 || brushUv.y > 1.0) ? 0.0 : opacity;
  opacity = (brushUv.x < 0.0 || brushUv.y < 0.0) ? 0.0 : opacity;

  opacity = clamp(opacity, 0.0, 1.0);

  float resOpacity = clamp(opacity  + canvasBaseColor.a * (1.0 - opacity), 0.0, 1.0); //mix(canvasBaseColor[3], opacity, opacity);


  vec3 resColor = oklab_mix( canvasBaseColor.xyz ,
                      u_color,
                      opacity );

  /* vec3 resColor = mix(canvasBaseColor.xyz, u_color, opacity); */

  /* resColor[0] = remix0(resColor, canvasBaseColor, opacity, brushUv);
  resColor[1] = remix1(resColor, canvasBaseColor, opacity, brushUv);
  resColor[2] = remix2(resColor, canvasBaseColor, opacity, brushUv); */

  gl_FragColor = resOpacity < 20.0 / 255.0 ? canvasBaseColor  : vec4(resColor, resOpacity);
}
