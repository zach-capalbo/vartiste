attribute vec4 a_position;
attribute vec4 a_boneWeights;
attribute vec4 a_boneIndices;
uniform float u_boneIndex;
/* varying vec2 vUv; */
varying vec4 vColor;

void main() {
  vec4 pos = a_position;
  pos.x = 2.0 * pos.x - 1.0;
  pos.y = (1.0 - pos.y) * 2.0 - 1.0;
  gl_Position = pos;

  vec3 paintColor = vec3(1.0, 1.0, 1.0);

  vColor = vec4(0.0, 0.0, 0.0, 0.0);
  vColor = u_boneIndex == a_boneIndices[0] ? vec4(paintColor, a_boneWeights[0]) : vColor;
  vColor = u_boneIndex == a_boneIndices[1] ? vec4(paintColor, a_boneWeights[1]) : vColor;
  vColor = u_boneIndex == a_boneIndices[2] ? vec4(paintColor, a_boneWeights[2]) : vColor;
  vColor = u_boneIndex == a_boneIndices[3] ? vec4(paintColor, a_boneWeights[3]) : vColor;
}
