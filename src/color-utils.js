const Color = require('color')

export function colorToHSB(color) {
  var c = Color()
  var {h,s,v} = colorsys.rgb_to_hsv(c.r * 255, c.g * 255, c.b * 255)

  console.log("hsv", c,h,s,v)

  return {h:h/360,s:s/255,b:v/255}
}


export function hsb2rgb(hsb) {
    var rgb = {};
    var h = Math.round(hsb.h * 360);
    var s = Math.round(hsb.s * 255);
    var v = Math.round(hsb.b * 255);
    if(s === 0) {
        rgb.r = rgb.g = rgb.b = v;
    } else {
        var t1 = v;
        var t2 = (255 - s) * v / 255;
        var t3 = (t1 - t2) * (h % 60) / 60;
        if( h === 360 ) h = 0;
        if( h < 60 ) { rgb.r = t1; rgb.b = t2; rgb.g = t2 + t3; }
        else if( h < 120 ) {rgb.g = t1; rgb.b = t2; rgb.r = t1 - t3; }
        else if( h < 180 ) {rgb.g = t1; rgb.r = t2; rgb.b = t2 + t3; }
        else if( h < 240 ) {rgb.b = t1; rgb.r = t2; rgb.g = t1 - t3; }
        else if( h < 300 ) {rgb.b = t1; rgb.g = t2; rgb.r = t2 + t3; }
        else if( h < 360 ) {rgb.r = t1; rgb.g = t2; rgb.b = t1 - t3; }
        else { rgb.r = 0; rgb.g = 0; rgb.b = 0; }
    }
    return {
        r: Math.round(rgb.r),
        g: Math.round(rgb.g),
        b: Math.round(rgb.b)
    };
}

export function hsbToHex({h,s,b})
{
  let {r,g,b:bb} = hsb2rgb({h,s,b})
  const toHex = x => {
    const hex = Math.round(x).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };
  console.log("rgb", r,g,bb)
  return `#${toHex(r)}${toHex(g)}${toHex(bb)}`;
}
