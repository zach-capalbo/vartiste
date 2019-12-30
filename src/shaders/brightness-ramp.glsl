varying vec2 vUv;

void main() {
  vec3 color = vec3(vUv.y);
  gl_FragColor = vec4(color, 1.0);
}
