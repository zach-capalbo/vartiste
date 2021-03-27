#version 100

precision mediump float;

varying vec3 vPosition;
varying vec2 vUv;

uniform sampler2D u_input;

uniform vec3 u_center;
uniform float u_size;
uniform vec4 u_color;
uniform mat4 u_matrix;

uniform vec3 u_rand;
uniform int u_shape;

uniform bool u_onion;
uniform bool u_bumpy;
uniform bool u_hard;
uniform bool u_noisy;
uniform bool u_bristles;

float rand3(vec3 co){
    return fract(sin(dot(co ,vec3(12.9898,78.233,34.23))) * 43758.5453);
}



float opOnion( in float sdf, in float thickness )
{
    return abs(sdf)-thickness;
}

vec3 opRep( in vec3 p, in vec3 c)
{
    vec3 q = mod(p+0.5*c,c)-0.5*c;
    return q;
}

/* vec3 opRepLim( in vec3 p, in float c, in vec3 l)
{
    vec3 q = p-c*clamp(round(p/c),-l,l);
    return q;
} */

float opDisplace(in float d, in vec3 p, in float size)
{
  p = p + u_rand;
  float d2 = 0.3 * u_size * sin(size*p.x)*sin(size*p.y)*sin(size*p.z);
  return d + d2 + u_size * 0.15;
}

vec3 opTwist( in vec3 p, float k )
{
    float c = cos(k*p.y);
    float s = sin(k*p.y);
    mat2  m = mat2(c,-s,s,c);
    vec3  q = vec3(m*p.xz,p.y);
    return q;
}

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

float sdVerticalCapsule( vec3 p, float h, float r )
{
  p.y -= clamp( p.y, 0.0, h );
  return length( p ) - r;
}

float sdHorizontalCapsule( vec3 p, float h, float r )
{
  p.x -= clamp( p.x, 0.0, h );
  return length( p ) - r;
}

float sdCylinder( vec3 p, vec3 c )
{
  /* return length(p.xz-c.xz)-c.y; */
  return length(p.xz-c.xy)-c.z;
}

float sdBrush(vec3 p)
{
  p.y += u_size / 2.0;
  vec3 pp = opRep(p, vec3(u_size, 0.0, 0.0));

  float teeth = sdVerticalCapsule(pp, u_size * 2.0, u_size * 0.3) + (abs(p.x) < u_size * 4.5 ? 0.0 : 4.5 * u_size + abs(p.x));

  pp = p;
  pp.x = abs(pp.x);
  float base = sdHorizontalCapsule(pp, u_size * 4.5, u_size * 0.3);

  return min(teeth, base);
}

float opBristles(in float d, vec3 p, in float size)
{
  p.x += 0.2 * sin(p.y * 2.0);
  p.z += 0.2 * cos(p.y * 1.0);
  p.x *= 3.0;
  p.z *= 3.0;
  vec3 q = p;
  q = opRep(q, vec3(2.0, 0.0, 2.0));
  /* q = mix(q, opTwist(q, 1.0), 0.3); */
  /* vec3 q = p; */
  /* float cylinder = sdCylinder(q, vec3(u_size * 2.0, u_size * 2.0, u_size * 0.6));//sdVerticalCapsule(q, u_size * 2.0, u_size * 0.3); */
  float cylinder = sdCylinder(q, vec3(2.0, 0.5, 0.6));
  cylinder = cylinder - size / 3.0;// * size * size;
  /* return cylinder - size; */
  return max(cylinder, d);
}


/* #pragma loader: import {sdBrush} from './brush.glsl' */

void main() {
  /* vec4 base = texture2D(u_input, vUv); */

  vec3 p = vPosition;

  p = p - u_center;

  p = (u_matrix * vec4(p, 1.0)).xyz;

  /* p = opRep(p, vec3(1.2, 1.2, 0)); */

  /* float d = 1.0 - clamp(distance(u_center, vPosition) / u_size, 0.0, 1.0); */

  float d = sdSphere(p, u_size);

  d = u_shape == 1 ? sdBoundingBox(p, vec3(u_size, u_size, u_size), u_size * 0.25) : d;
  d = u_shape == 2 ? sdBox(p, vec3(u_size, u_size, u_size)) : d;
  d = u_shape == 3 ? sdCone(p, vec2(0.9486832980505139, 0.31622776601683794), u_size * 3.0) : d;
  d = u_shape == 4 ? sdBrush(p) : d;

  d = u_onion ? opOnion(d, u_size * 0.2) : d;

  d = u_bumpy ? opDisplace(d, p, 20.0) : d;

  d = u_bristles ? opBristles(d, p, u_size) : d;

  d = d / pow(u_size, 1.0 / 3.0);

  d = clamp(-d, 0.0, 1.0);

  d = u_hard ? smoothstep(0.0, u_size * 0.2, d) : d;

  d = u_noisy ? d * rand3(p) : d;

  /* d = d - 0.01; */

  d = d * u_color.a;

  gl_FragColor = vec4(u_color.xyz * d, d);

}
