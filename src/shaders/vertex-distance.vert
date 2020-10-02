attribute vec4 a_position;
/* attribute vec2 a_uv; */
attribute vec4 a_color;
/* varying vec2 vUv; */
varying vec4 vColor;

void main() {
  a_color;
  vec4 pos = a_position;
  pos.x = 2.0 * pos.x - 1.0;
  pos.y = (1.0 - pos.y) * 2.0 - 1.0;
  gl_Position = pos;

  vColor = a_color;
}
