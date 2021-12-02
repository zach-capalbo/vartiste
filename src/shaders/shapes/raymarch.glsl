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
vec2 hitBox( vec3 orig, vec3 dir ) {
	const vec3 box_min = vec3( - 1 );
	const vec3 box_max = vec3( 1 );
	vec3 inv_dir = 1.0 / dir;
	vec3 tmin_tmp = ( box_min - orig ) * inv_dir;
	vec3 tmax_tmp = ( box_max - orig ) * inv_dir;
	vec3 tmin = min( tmin_tmp, tmax_tmp );
	vec3 tmax = max( tmin_tmp, tmax_tmp );
	float t0 = max( tmin.x, max( tmin.y, tmin.z ) );
	float t1 = min( tmax.x, min( tmax.y, tmax.z ) );
	return vec2( t0, t1 );
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
vec3 opTwist( in vec3 p, float k )
{
    float c = cos(k*p.y);
    float s = sin(k*p.y);
    mat2  m = mat2(c,-s,s,c);
    vec3  q = vec3(m*p.xz,p.y);
    return q;
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

float sdBrush(vec3 p)
{
  float u_size = 1.0;
  p.y += u_size / 2.0;
  vec3 pp = opRep(p, vec3(u_size, 0.0, 0.0));

  float teeth = sdVerticalCapsule(pp, u_size * 2.0, u_size * 0.3) + (abs(p.x) < u_size * 4.5 ? 0.0 : 4.5 * u_size + abs(p.x));

  pp = p;
  pp.x = abs(pp.x);
  float base = sdHorizontalCapsule(pp, u_size * 4.5, u_size * 0.3);

  return min(teeth, base);
}
float sdSphere( vec3 p, float s )
{
  return length(p)-s;
}
float opUnion( float d1, float d2 ) { return min(d1,d2); }

float opSubtraction( float d1, float d2 ) { return max(-d1,d2); }

float opIntersection( float d1, float d2 ) { return max(d1,d2); }

float sample1( vec3 p ) {
  /* p = opRep(p, vec3(0.1)); */
  p = p - 0.5;
  p = p * 3.0;
  p = opTwist(p, 10.0);
  float d = sdSphere(p, 0.4);
  d = opSubtraction(d, sdVerticalCapsule(p + 0.1, 0.7, 0.3));
  /* d = opOnion(d, 0.3); */
	return - d;
}
#define epsilon .0001
vec3 normal( vec3 coord ) {
	if ( coord.x < epsilon ) return vec3( 1.0, 0.0, 0.0 );
	if ( coord.y < epsilon ) return vec3( 0.0, 1.0, 0.0 );
	if ( coord.z < epsilon ) return vec3( 0.0, 0.0, 1.0 );
	if ( coord.x > 1.0 - epsilon ) return vec3( - 1.0, 0.0, 0.0 );
	if ( coord.y > 1.0 - epsilon ) return vec3( 0.0, - 1.0, 0.0 );
	if ( coord.z > 1.0 - epsilon ) return vec3( 0.0, 0.0, - 1.0 );
	float step = 0.01;
	float x = sample1( coord + vec3( - step, 0.0, 0.0 ) ) - sample1( coord + vec3( step, 0.0, 0.0 ) );
	float y = sample1( coord + vec3( 0.0, - step, 0.0 ) ) - sample1( coord + vec3( 0.0, step, 0.0 ) );
	float z = sample1( coord + vec3( 0.0, 0.0, - step ) ) - sample1( coord + vec3( 0.0, 0.0, step ) );
	return normalize( vec3( x, y, z ) );
}
void main(){
	vec3 rayDir = normalize( vDirection );
	vec2 bounds = hitBox( vOrigin, rayDir );
	if ( bounds.x > bounds.y ) discard;
	bounds.x = max( bounds.x, 0.0 );
	vec3 p = vOrigin + bounds.x * rayDir;
	vec3 inc = 1.0 / abs( rayDir );
	float delta = min( inc.x, min( inc.y, inc.z ) );
	float nearDepth = 0.5 + 0.5 * oppositeSide.z / oppositeSide.w;
	delta /= steps;
	float t;
	for ( t = bounds.x; t < bounds.y; t += delta ) {
		float d = sample1( p + 0.5 );
    if (d > 0.0)
    {
			vec3 normal = normal( p + 0.5 );// * 0.5 + ( p * 1.5 + 0.25 );

      vec3 viewDir = normalize(rayDir);
      vec3 x = normalize( vec3( viewDir.z, 0.0, - viewDir.x ) );
    	vec3 y = cross( viewDir, x );
    	vec2 uv = vec2( dot( x, normal ), dot( y, normal ) ) * 0.495 + 0.5;

      color = texture(matcap, uv);
      if ( d > threshold ) {
        /* color = vec4(uv, 1.0, 1.0); */
        /* color.rgb = vec3(d, d, d); */
  			/* color.a = 1.; */
        /* color.a = smoothstep(0.00001, 0.03, d); */
        color.a = 1.;
        color.rgb = color.rgb * color.a;
        /* gl_FragDepth = gl_FragCoord.z - 1.0; */
  			break;
  		}
      else
      {
        /* color.a = smoothstep(0, threshold, d);
        color.rgb = color.rgb * color.a; */
      }
    }
		p += rayDir * delta;
	}
	/* if ( color.a == 0.0 ) discard; */
	gl_FragDepth = mix(gl_FragCoord.z, nearDepth, (t - bounds.x) / (bounds.x - bounds.y));
	if (color.a == 0.0) {
		/* gl_FragDepth = gl_FragCoord.z; */
		color = vec4(1.0, 0.0, 1.0, 1.0);
	}
}
