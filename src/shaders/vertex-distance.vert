attribute vec4 a_position;
attribute vec4 a_vertexPosition;
varying vec2 vUv;
varying vec3 vPosition;

void main() {
  vec4 pos = a_position;
  pos.x = 2.0 * pos.x - 1.0;
  pos.y = (1.0 - pos.y) * 2.0 - 1.0;
  gl_Position = pos;

  vPosition = a_vertexPosition.xyz;
  vUv = vec2((a_position.x + 1.0) / 2.0, 1.0 - (a_position.y + 1.0) / 2.0);
}
