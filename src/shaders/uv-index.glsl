/*
uniform float u_width;
uniform float u_height;
uniform sampler2D u_input;
uniform sampler2D u_source_1; */
varying vec2 vUv;

#if NUM_CLIPPING_PLANES > 0
varying vec3 vClipPosition;
uniform vec4 clippingPlanes[ NUM_CLIPPING_PLANES ];
#endif


void main() {
  /* gl_FragColor = vec4(vUv.x, vUv.y, 1.0, 1.0) */
/*
  int u = int(vUv.x);
  int v = int(vUv.y); */
  #if NUM_CLIPPING_PLANES > 0
  	vec4 plane;
  	#pragma unroll_loop_start
  	for ( int i = 0; i < UNION_CLIPPING_PLANES; i ++ ) {
  		plane = clippingPlanes[ i ];
  		if ( dot( vClipPosition, plane.xyz ) > plane.w ) discard;
  	}
  	#pragma unroll_loop_end
  	#if UNION_CLIPPING_PLANES < NUM_CLIPPING_PLANES
  		bool clipped = true;
  		#pragma unroll_loop_start
  		for ( int i = UNION_CLIPPING_PLANES; i < NUM_CLIPPING_PLANES; i ++ ) {
  			plane = clippingPlanes[ i ];
  			clipped = ( dot( vClipPosition, plane.xyz ) > plane.w ) && clipped;
  		}
  		#pragma unroll_loop_end
  		if ( clipped ) discard;
  	#endif
  #endif

  float u = floor(vUv.x * 4096.0 + 0.5);
  float v = floor(vUv.y * 4096.0 + 0.5);

  float fudge = vUv.x >= 0.5 ? 1.0 : 0.0;

  gl_FragColor = vec4(
      floor(mod(u, 256.0)) / 256.0,
      floor(mod(v, 256.0)) / 256.0,
      (floor(u / 256.0) * 16.0 + floor(v / 256.0)) / 256.0 + fudge / 255.0,
      1.0
    );

  /* gl_FragColor = vec4(mod(u, 256.0) / 255.0,  floor(u / 256.0) / 255.0, mod(v, 256.0) / 255.0, floor(v / 256.0) / 255.0); */
}
