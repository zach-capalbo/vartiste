in vec3 position;
in vec3 normal;
uniform mat4 modelMatrix;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform vec3 cameraPos;
out vec3 vOrigin;
out vec3 vDirection;
out vec3 lookDir;
out vec4 oppositeSide;
void main() {
  vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );
  vOrigin = vec3( inverse( modelMatrix ) * vec4( cameraPos, 1.0 ) ).xyz;
  vDirection = position - vOrigin;
  lookDir = (mvPosition).xyz - cameraPos;
  gl_Position = projectionMatrix * mvPosition;

  vec4 oppositeSide4 = modelViewMatrix * vec4( position - 1.0 * normal, 1.0);
  oppositeSide = projectionMatrix * oppositeSide4;
  /* gl_Position.z = oppositeSide.z;
  gl_Position.w = oppositeSide.w; */
}
