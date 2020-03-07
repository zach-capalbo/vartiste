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

vec2 calcBrushUv(float x, float y) {
  return vec2(
    (vUv.x - (x - u_brush_width / 2.0) / u_width) * u_width / u_brush_width,
    (vUv.y - (y - u_brush_height / 2.0) / u_height) * u_height / u_brush_height
    );
}

float rand(vec2 co){
    return fract(sin(dot(co.xy + fract(u_t),vec2(12.9898,78.233))) * 43758.5453);
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
                      u_color + 4.0 * (rand(brushUv) - 0.5) / 256.0,
                      opacity );

  float resOpacity = mix(canvasBaseColor[3], 1.0, opacity);
  gl_FragColor = opacity < 0.001 ? canvasBaseColor  : vec4(resColor, resOpacity);
}
