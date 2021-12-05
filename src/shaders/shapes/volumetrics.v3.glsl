#version 100

precision mediump float;

varying vec3 vPosition;
varying vec2 vUv;

uniform sampler2D u_input;

uniform vec3 u_center;
uniform float u_size;
uniform vec4 u_color;
uniform mat4 u_matrix;
uniform float u_userScale;

uniform vec3 u_rand;
uniform int u_shape;

uniform bool u_onion;
uniform bool u_bumpy;
uniform bool u_hard;
uniform bool u_noisy;
uniform bool u_bristles;

#include "ops.glsl"
#include "shapes.glsl"
#include "brush.glsl"

void main() {
  /* vec4 base = texture2D(u_input, vUv); */

  vec3 p = vPosition;

  p = p - u_center;

  p = (u_matrix * vec4(p, 1.0)).xyz;

  /* p = opRep(p, vec3(1.2, 1.2, 0)); */

  /* float d = 1.0 - clamp(distance(u_center, vPosition) / u_size, 0.0, 1.0); */

  float d = makeBrush(p);

  d = d / pow(u_size, 1.0 / 3.0);

  d = clamp(-d, 0.0, 1.0);

  d = d * u_userScale;

  d = u_hard ? smoothstep(0.0, u_size * 0.2, d) : d;

  d = u_noisy ? d * rand3(p) : d;

  /* d = d - 0.01; */

  vec4 color = u_color;

  color.r = pow(color.r, 1.0 / 2.2);
  color.g = pow(color.g, 1.0 / 2.2);
  color.b = pow(color.b, 1.0 / 2.2);

  d = d * color.a;

  gl_FragColor = vec4(color.xyz * d, d);

}
