precision mediump float;
varying vec3 vPosition;
float sdSphere( vec3 p, float s )
{
  return length(p)-s;
}

vec3 opTwist( in vec3 p, float k )
{
    float c = cos(k*p.y);
    float s = sin(k*p.y);
    mat2  m = mat2(c,-s,s,c);
    vec3  q = vec3(m*p.xz,p.y);
    return q;
}

float sdBoxFrame( vec3 p, vec3 b, float e )
{
  p = abs(p  )-b;
  vec3 q = abs(p+e)-e;
  return min(min(
      length(max(vec3(p.x,q.y,q.z),0.0))+min(max(p.x,max(q.y,q.z)),0.0),
      length(max(vec3(q.x,p.y,q.z),0.0))+min(max(q.x,max(p.y,q.z)),0.0)),
      length(max(vec3(q.x,q.y,p.z),0.0))+min(max(q.x,max(q.y,p.z)),0.0));
}

void main() {
  vec3 color = vec3(1.0, 0.0, 1.0);

  vec3 p = vPosition;
  p.x -= 0.5
  p.y -= 0.5

  p = opTwist(p, 1.0);

  p.x *= 2.0;

  float d;

  d = sdBoxFrame(p, vec3(0.5, 0.5, 0.51), 0.01)
  d = min(sdSphere(p, 0.5), d);

  if (d > 0.0) discard;

  color = mix(vec3(0.0, 0.0, 0.0), color, clamp(-d * 500.0, 0.0, 1.0));
  /* float alpha = clamp(-d, 0.0, 1.0);
  gl_FragColor = vec4(color * alpha, alpha); */
  gl_FragColor = vec4(color, 1.0); //clamp(-d, 0.0, 1.0));
}
