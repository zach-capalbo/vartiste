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

const int u_shape = 5;
const float u_userScale = 1.0;

#include "ops.glsl"
#include "shapes.glsl"
#include "brush.glsl"
#include "raymarch.glsl"

float sampleSDF( vec3 p, bool normalPass ) {
  /* p = opRep(p, vec3(0.1)); */
  p = p - 0.5;
   /* p = p * 3.0; */
  /* p = opTwist(p, 10.0); */
  float d = makeBrush(p);

	// d = normalPass ? d : opWireFrame(d, p, 0.05, 0.003);
	/* d = sdSphere(p, 0.4); */
  /* d = opSubtraction(d, sdVerticalCapsule(p + 0.1, 0.7, 0.3)); */
  /* d = opOnion(d, 0.3); */
	return - d;
}

void main() {
  raymarch();
}
