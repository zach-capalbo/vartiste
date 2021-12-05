float rand3(vec3 co){
    return fract(sin(dot(co ,vec3(12.9898,78.233,34.23))) * 43758.5453);
}

float opUnion( float d1, float d2 ) { return min(d1,d2); }

float opSubtraction( float d1, float d2 ) { return max(-d1,d2); }

float opIntersection( float d1, float d2 ) { return max(d1,d2); }

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

float sdCylinder( vec3 p, vec3 c );
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

float sdBox( vec3 p, vec3 b );
float opWireFrame(float d, vec3 p, float gridSpacing, float gridScale)
{
	vec3 gridP = opRep(p, vec3(u_size * gridSpacing));
	float grid = sdBox(gridP, vec3(9999.0, u_size * gridScale, u_size * gridScale));
	grid = min(grid, sdBox(gridP, vec3(u_size * gridScale, 9999.0, u_size * gridScale)));
	grid = min(grid, sdBox(gridP, vec3(u_size * gridScale, u_size * gridScale, 9999.0)));
	/* d = abs(d) > 0.01 ? 999.0 : d; */
  d = abs(d) - 0.04 * u_size;
	d = opIntersection(grid, d);
  /* return grid; */
  return d;
}

float opSmoothUnion( float d1, float d2, float k )
{
  float h = clamp( 0.5 + 0.5*(d2-d1)/k, 0.0, 1.0 );
  return mix( d2, d1, h ) - k*h*(1.0-h);
}

float opSmoothSubtraction( float d1, float d2, float k )
{
  float h = clamp( 0.5 - 0.5*(d2+d1)/k, 0.0, 1.0 );
  return mix( d2, -d1, h ) + k*h*(1.0-h);
}

float opSmoothIntersection( float d1, float d2, float k )
{
  float h = clamp( 0.5 - 0.5*(d2-d1)/k, 0.0, 1.0 );
  return mix( d2, d1, h ) + k*h*(1.0-h);
}
