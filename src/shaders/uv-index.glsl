/*
uniform float u_width;
uniform float u_height;
uniform sampler2D u_input;
uniform sampler2D u_source_1; */
varying vec2 vUv;

void main() {
  /* gl_FragColor = vec4(vUv.x, vUv.y, 1.0, 1.0) */
/*
  int u = int(vUv.x);
  int v = int(vUv.y); */

  float u = floor(vUv.x * 4096.0 + 0.5);
  float v = floor(vUv.y * 4096.0 + 0.5);

  float fudge = vUv.x >= 0.5 ? 1.0 : 0.0;

  gl_FragColor = vec4(
      floor(mod(u, 256.0)) / 256.0,
      floor(mod(v, 256.0)) / 256.0,
      (floor(u / 256.0) * 16.0 + floor(v / 256.0)) / 256.0 + fudge / 256.0,
      1.0
    )

  /* gl_FragColor = vec4(mod(u, 256.0) / 255.0,  floor(u / 256.0) / 255.0, mod(v, 256.0) / 255.0, floor(v / 256.0) / 255.0); */
}
