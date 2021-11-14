varying vec2 vUv;
varying vec3 vClipPosition;
void main() {
  vUv = uv;
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  vClipPosition = - mvPosition.xyz;
  gl_Position = projectionMatrix * mvPosition;
}
