varying vec2 vUv;

void main() {
  vec3 fgColor = vec3(1.0, 1.0, 1.0);

  /* float grid = step(fract(vUv.y * 10.0), 0.3) + step(fract(vUv.x * 10.0),0.3);
  vec3 bgColor = mix(vec3(0.3, 0.3, 0.3), vec3(0.15, 0.1, 0.1), grid);
  vec3 color = mix(fgColor, bgColor, vUv.y); */
  gl_FragColor = vec4(fgColor, vUv.x);
}
