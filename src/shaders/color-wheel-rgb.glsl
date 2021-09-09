#define M_PI2 6.28318530718
uniform float brightness;
varying vec2 vUv;
vec3 hsb2rgb(in vec3 c){
    vec3 rgb = clamp(abs(mod(c.x * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0,
                     0.0,
                     1.0 );
    rgb = rgb * rgb * (3.0 - 2.0 * rgb);
    return c.z * mix( vec3(1.0), rgb, c.y);
}

void main() {
  vec2 toCenter = vec2(0.5) - vUv;
  float angle = atan(toCenter.y, toCenter.x);
  float radius = length(toCenter) * 2.0;
  vec3 color = hsb2rgb(vec3((angle / M_PI2) + 0.5, radius, brightness));
  gl_FragColor = vec4(color, 1.0);
}
