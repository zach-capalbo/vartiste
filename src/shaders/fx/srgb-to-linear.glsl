#version 100

precision mediump float;

uniform float u_width;
uniform float u_height;
uniform sampler2D u_input;
varying vec2 vUv;

/* const float gamma = 2.2;
#pragma loader: import {toLinear} from '../srgb-linear.glsl' */

void main() {
  vec4 color = texture2D(u_input, vec2(vUv.x, vUv.y));
  color.r = pow(color.r, 2.2);
  color.g = pow(color.g, 2.2);
  color.b = pow(color.b, 2.2);
  gl_FragColor = color;
}
