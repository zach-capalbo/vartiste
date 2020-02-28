#version 100

precision mediump float;

uniform sampler2D u_input;
varying vec2 vUv;

float rand(vec2 co){
    return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453);
}

void main() {
  vec4 color1 = texture2D(u_input, vUv);
  vec4 fullColor = vec4(color1.xyz / color1[3], 1.0);
  gl_FragColor = rand(vUv) < color1[3] ? fullColor : vec4(0.0);
}
