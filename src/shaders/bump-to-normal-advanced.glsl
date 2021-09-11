#version 100

precision mediump float;

uniform float u_width;
uniform float u_height;
uniform float u_bumpScale;
uniform int u_invert;
uniform int u_alphaOnly;
uniform sampler2D u_input;
varying vec2 vUv;

float sampleBump(vec2 pos)
{
  vec4 c = texture2D(u_input, pos);
  return u_alphaOnly == 1 ? c.a : c.r * c.a;
}

void main() {
  float scale = u_bumpScale > 0.0 ? 1.5 - u_bumpScale : 1.0 / 10.0;

  vec2 pixel = vec2(1.0 / u_width, 1.0 / u_height);

  /* vec4 color = texture2D(u_input, vec2(vUv.x, vUv.y)); */

  float height_pu = sampleBump(vec2(vUv.x + pixel.x, vUv.y));
  float height_mu = sampleBump(vec2(vUv.x - pixel.x, vUv.y));
  float height_pv = sampleBump(vec2(vUv.x, vUv.y + pixel.y));
  float height_mv = sampleBump(vec2(vUv.x, vUv.y - pixel.y));

  float du = height_mu - height_pu;
  float dv = height_mv - height_pv;

  vec3 vec = normalize(vec3(du, dv, scale));
  vec.x += 0.5;
  vec.y += 0.5;
  vec = clamp(vec, vec3(0.0, 0.0, 0.0), vec3(1.0, 1.0, 1.0));

  vec.y = u_invert == 1 ? 1.0 - vec.y : vec.y;
  /* vec.y = 1.0 - vec.y; */

  gl_FragColor = vec4(vec, 1.0);
}
