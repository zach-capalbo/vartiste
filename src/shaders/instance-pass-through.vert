precision mediump float;
attribute vec3 position;
attribute mat4 instanceMatrix;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;

varying vec3 vPosition;
void main() {

  /* vec4 mvPosition = instanceMatrix * vec4(position, 1.0);
  vPosition = mvPosition.xyz;
  mvPosition = modelViewMatrix * mvPosition;
  gl_Position = projectionMatrix * mvPosition; */

  vec4 mvPosition = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  vPosition = mvPosition.xyz;
  mvPosition = instanceMatrix * vec4(position, 1.0);
  mvPosition = modelViewMatrix * mvPosition;
  gl_Position = projectionMatrix * mvPosition;

  /* vec2 alignedPosition = ( ( position.xy  ) + mvPosition.xy );
  mvPosition = vec4( modelViewMatrix[3][0], modelViewMatrix[3][1], modelViewMatrix[3][2], modelViewMatrix[3][3] );
  mvPosition.xy += alignedPosition;
  gl_Position = projectionMatrix * mvPosition; */

  /* gl_Position = projectionMatrix * (modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0) + vec4(position.x, position.y, 0.0, 0.0)); */
  /* mvPosition = modelViewMatrix * mvPosition;
  mvPosition = projectionMatrix * mvPosition;
  gl_Position = mvPosition; */
}
