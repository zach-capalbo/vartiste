precision highp float;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
in vec3 vOrigin;
in vec3 vDirection;
in vec3 lookDir;
in vec4 oppositeSide;
out vec4 color;
uniform float threshold;
uniform float steps;
uniform sampler2D matcap;
uniform float u_rand;

uniform bool u_onion;
uniform bool u_bumpy;
uniform bool u_hard;
uniform bool u_noisy;
uniform bool u_bristles;
uniform float u_size;

const int u_shape = 3;
const float u_userScale = 1.0;

struct SceneObject {
  mat4 matrix;
  vec3 color;

  int shape;
  vec4 size;
  int op;
  int last;
};
#define NUM_SCENE_OBJECTS 2
uniform SceneObject u_scene[NUM_SCENE_OBJECTS];

#include "ops.glsl"
#include "shapes.glsl"
#include "brush.glsl"
#include "raymarch.glsl"

float sampleObject(vec3 p, SceneObject object) {
  p = (inverse(object.matrix) * vec4(p, 1.0)).xyz;

  switch (object.shape)
  {
    case 0: return sdSphere(p, object.size.x);
    case 1: return sdBoundingBox(p, object.size.xyz, object.size.w);
  }
  return 0.0;
}

float sampleObjectOp(vec3 p, float d, float objectD, SceneObject object)
{
  const float smoothK = 0.1;
  switch (object.op)
  {
    case 0: return opUnion(d, objectD);
    case 1: return opSubtraction(objectD, d);
    case 2: return opIntersection(objectD, d);
    case 3: return opSmoothUnion(objectD, d, smoothK);
    case 4: return opSmoothSubtraction(objectD, d, smoothK);
    case 5: return opSmoothIntersection(objectD, d, smoothK);
  }
  return d;
}

float sampleSDF( vec3 p, bool normalPass ) {

  p = p - 0.5;
  float d = sampleObject(p, u_scene[0]);

  for (int i = 1; i < NUM_SCENE_OBJECTS; i++)
  {
	  /* d = opSmoothUnion(sampleObject(p, u_scene[i]), d, 0.04); */
    d = sampleObjectOp(p, d, sampleObject(p, u_scene[i]), u_scene[i]);
    if (u_scene[i].last == 1) break;
  }

	return - d;
}

void main() {
  raymarch();
}
