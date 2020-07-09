vec2 calcBrushUv(float x, float y) {
  vec2 point = vec2(
    (vUv.x - (x - u_brush_width / 2.0) / u_width) * u_width / u_brush_width,
    (vUv.y - (y - u_brush_height / 2.0) / u_height) * u_height / u_brush_height
    );

  vec2 offsetPoint = point - 0.5;
  float len = length(offsetPoint);
  float angle = atan(offsetPoint.y, offsetPoint.x);
  angle -= u_brush_rotation;
  point.x = len * cos(angle) + 0.5;
  point.y = len * sin(angle) + 0.5;
  return point;
}

vec2 calcBrushUvScale(float x, float y, float scale) {
  vec2 point = vec2(
    (vUv.x - (x - (u_brush_width * scale)/ 2.0) / u_width) * u_width / (u_brush_width * scale),
    (vUv.y - (y - (u_brush_height * scale)/ 2.0) / u_height) * u_height / (u_brush_height * scale)
    );

  vec2 offsetPoint = point - 0.5;
  float len = length(offsetPoint);
  float angle = atan(offsetPoint.y, offsetPoint.x);
  angle -= u_brush_rotation;
  point.x = len * cos(angle) + 0.5;
  point.y = len * sin(angle) + 0.5;
  return point;
}

float rand(vec2 co){
    return fract(sin(dot(co.xy + (u_t),vec2(12.9898,78.233))) * 43758.5453);
}
