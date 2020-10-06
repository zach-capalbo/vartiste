#version 100

precision mediump float;

uniform sampler2D u_input;
uniform vec3 u_center;
uniform vec4 u_color;
uniform float u_size;
uniform int u_shape;
uniform mat4 u_matrix;
varying vec3 vPosition;
varying vec2 vUv;

float sdSphere( vec3 p, float s )
{
  return length(p)-s;
}

float sdBox( vec3 p, vec3 b )
{
  vec3 q = abs(p) - b;
  return length(max(q,0.0)) + min(max(q.x,max(q.y,q.z)),0.0);
}

float sdBoundingBox( vec3 p, vec3 b, float e )
{
       p = abs(p  )-b;
  vec3 q = abs(p+e)-e;
  return min(min(
      length(max(vec3(p.x,q.y,q.z),0.0))+min(max(p.x,max(q.y,q.z)),0.0),
      length(max(vec3(q.x,p.y,q.z),0.0))+min(max(q.x,max(p.y,q.z)),0.0)),
      length(max(vec3(q.x,q.y,p.z),0.0))+min(max(q.x,max(q.y,p.z)),0.0));
}

float sdCone( vec3 p, vec2 c, float h )
{
  p.y -= h / 2.0;
  float q = length(p.xz);
  return max(dot(c.xy,vec2(q,p.y)),-h-p.y);
}

void main() {
  vec4 base = texture2D(u_input, vUv);

  vec3 p = vPosition;

  p = p - u_center;

  p = (u_matrix * vec4(p, 1.0)).xyz;

  /* float d = 1.0 - clamp(distance(u_center, vPosition) / u_size, 0.0, 1.0); */

  float d = sdSphere(p, u_size);

  d = u_shape == 1 ? sdBoundingBox(p, vec3(u_size, u_size, u_size), u_size * 0.25) : d;
  d = u_shape == 2 ? sdBox(p, vec3(u_size, u_size, u_size)) : d;
  d = u_shape == 3 ? sdCone(p, vec2(0.9486832980505139, 0.31622776601683794), u_size * 3.0) : d;

  d = clamp(-d, 0.0, 1.0)

  d = d * u_color.a;
  /* gl_FragColor = mix(base, vec4(u_color.xyz * d, d), d); */
  gl_FragColor = vec4(u_color.xyz * d, d);
  /* gl_FragColor = vec4((vPosition.xyz + 40.0)/ 80.0, 1.0); */
}
