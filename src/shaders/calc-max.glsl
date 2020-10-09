#version 100

precision mediump float;

#define HEIGHT 1.0

uniform float u_width;
uniform float u_height;
uniform sampler2D u_input;
varying vec2 vUv;

void main() {
  float max = 0.0;

  for (float i = 0.0; i < HEIGHT; ++i)
  {
    max += texture2D(u_input, vec2(vUv.x, i / HEIGHT)).a;
  }

  max = max > 0.0 ? 1.0 : 0.0;
  gl_FragColor = vec4(max, max, max, 1.0);
}
