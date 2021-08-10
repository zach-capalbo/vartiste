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

vec3 hsv2rgb(vec3 c) {
  vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

vec4 mixByBrush(vec4 color) {
  vec4 canvasBaseColor = texture2D(u_input, vUv);
  vec2 brushUv = calcBrushUv(u_x, u_y);
  vec4 brushColor = texture2D(u_brush, brushUv);

  float opacity = brushColor[3];
  opacity = opacity * u_opacity;
  opacity = opacity < 0.000001 ? -99.0 : opacity;
  opacity += 4.0 * (rand(brushUv) - 0.5) / 256.0

  opacity = (brushUv.x > 1.0 || brushUv.y > 1.0) ? 0.0 : opacity;
  opacity = (brushUv.x < 0.0 || brushUv.y < 0.0) ? 0.0 : opacity;

  opacity = clamp(opacity, 0.0, 1.0);

  return mix( canvasBaseColor,
                      color ,
                      opacity );
}
