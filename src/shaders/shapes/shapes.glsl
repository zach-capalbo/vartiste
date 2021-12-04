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
