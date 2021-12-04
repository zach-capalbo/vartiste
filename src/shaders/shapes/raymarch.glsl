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

float sampleSDF(vec3 p, bool normalPass);

float sample1(vec3 p) {
	return sampleSDF(p, true);
}

#define epsilon .0001
vec3 normal( vec3 coord ) {
	/* if ( coord.x < epsilon ) return vec3( 1.0, 0.0, 0.0 );
	if ( coord.y < epsilon ) return vec3( 0.0, 1.0, 0.0 );
	if ( coord.z < epsilon ) return vec3( 0.0, 0.0, 1.0 );
	if ( coord.x > 1.0 - epsilon ) return vec3( - 1.0, 0.0, 0.0 );
	if ( coord.y > 1.0 - epsilon ) return vec3( 0.0, - 1.0, 0.0 );
	if ( coord.z > 1.0 - epsilon ) return vec3( 0.0, 0.0, - 1.0 ); */
	float step = 0.01;
	float x = sample1( coord + vec3( - step, 0.0, 0.0 ) ) - sample1( coord + vec3( step, 0.0, 0.0 ) );
	float y = sample1( coord + vec3( 0.0, - step, 0.0 ) ) - sample1( coord + vec3( 0.0, step, 0.0 ) );
	float z = sample1( coord + vec3( 0.0, 0.0, - step ) ) - sample1( coord + vec3( 0.0, 0.0, step ) );
	return normalize( vec3( x, y, z ) );
}
void raymarch(){
	vec3 rayDir = normalize( vDirection );
	vec2 bounds = hitBox( vOrigin, rayDir );
	if ( bounds.x > bounds.y ) discard;
	bounds.x = max( bounds.x, 0.0 );
	vec3 p = vOrigin + bounds.x * rayDir;
	vec3 inc = 1.0 / abs( rayDir );
	float delta = min( inc.x, min( inc.y, inc.z ) );
	float nearDepth = 0.5 + 0.5 * oppositeSide.z / oppositeSide.w;
	float depth = gl_FragCoord.z;
	delta /= steps;
	float t;
	for ( t = bounds.x; t < bounds.y; t += delta ) {
		float d = sampleSDF( p + 0.5, false );
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
	if ( color.a == 0.0 ) discard;
	gl_FragDepth = depth;
	/* gl_FragDepth = mix(gl_FragCoord.z, nearDepth, (t - bounds.x) / (bounds.x - bounds.y)); */
	if (color.a == 0.0) {
		/* gl_FragDepth = gl_FragCoord.z; */
		color = vec4(1.0, 0.0, 1.0, 1.0);
	}
}
