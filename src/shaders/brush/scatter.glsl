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

vec4 scatter() {
  vec2 uv = vec2(vUv.x + (rand(vUv) - 0.5) * u_brush_width / u_width * 0.5,
                 vUv.y + (rand(vUv * 7.414556064744165) - 0.5) * u_brush_height / u_height * 0.5
                 );
  return texture2D(u_input, uv);
}

void main() {
  vec4 color = scatter();

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
