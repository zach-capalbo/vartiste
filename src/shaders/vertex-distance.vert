attribute vec4 a_position;
attribute vec4 a_vertexPosition;
attribute vec4 a_vertexIndex;
uniform bool u_checkIntersection;
varying vec2 vUv;
varying vec3 vPosition;

float modI(float a,float b) {
    float m=a-floor((a+0.5)/b)*b;
    return floor(m+0.5);
}

void main() {
  vec4 pos = a_position;
  pos.x = 2.0 * pos.x - 1.0;
  pos.y = (1.0 - pos.y) * 2.0 - 1.0;

  /* int id3 = int(modI(float(a_vertexIndex), 3.0));
  pos.x = (u_checkIntersection && id3 == 0) ? -1.0 : pos.x;
  pos.x = (u_checkIntersection && id3 == 1) ? -0.99 : pos.x;
  pos.x = (u_checkIntersection && id3 == 2) ? -1.0 : pos.x;

  pos.y = (u_checkIntersection && id3 == 0) ? 1.0 : pos.y;
  pos.y = (u_checkIntersection && id3 == 1) ? 1.0 : pos.y;
  pos.y = (u_checkIntersection && id3 == 2) ? 0.99: pos.y; */

  gl_Position = pos;

  vPosition = a_vertexPosition.xyz;
  vUv = vec2((a_position.x + 1.0) / 2.0, 1.0 - (a_position.y + 1.0) / 2.0);
}
