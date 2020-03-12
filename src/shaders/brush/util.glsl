vec2 calcBrushUv(float x, float y) {
  return vec2(
    (vUv.x - (x - u_brush_width / 2.0) / u_width) * u_width / u_brush_width,
    (vUv.y - (y - u_brush_height / 2.0) / u_height) * u_height / u_brush_height
    );
}

float rand(vec2 co){
    return fract(sin(dot(co.xy + (u_t),vec2(12.9898,78.233))) * 43758.5453);
}
