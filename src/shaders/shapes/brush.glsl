float makeBrush(vec3 p) {
  float d = sdSphere(p, u_size);

  d = u_shape == 1 ? sdBoundingBox(p, vec3(u_size, u_size, u_size), u_size * 0.25) : d;
  d = u_shape == 2 ? sdBox(p, vec3(u_size, u_size, u_size)) : d;
  d = u_shape == 3 ? sdCone(p, vec2(0.9486832980505139, 0.31622776601683794), u_size * 3.0) : d;
  d = u_shape == 4 ? sdBrush(p) : d;

  d = u_onion ? opOnion(d, u_size * 0.2) : d;

  d = u_bumpy ? opDisplace(d, p, 20.0) : d;

  d = u_bristles ? opBristles(d, p, u_size) : d;

  return d;
}
