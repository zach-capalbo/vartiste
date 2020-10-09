varying vec2 vUv;
varying vec4 vPosition;
uniform bool u_checkIntersection;

void main() {
  vUv = uv;
  vPosition = position;
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  vec4 intersect_vert = gl_VertexID % 3;
  gl_Position = u_checkIntersection ? intersect_vert : vec4(projectionMatrix * mvPosition;
}
