#version 100

precision mediump float;

uniform sampler2D u_input;
varying vec2 vUv;

float rand(vec2 co){
    return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453);
}

void main() {
  vec4 color1 = texture2D(u_input, vUv);
  gl_FragColor = vec4((color1.xyz + (rand(vUv) - 0.5)) * color1[3], color1[3]);
}
