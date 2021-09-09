#define M_PI2 6.28318530718
#define M_PI 3.1415926535897932384626433832795
uniform float brightness;
varying vec2 vUv;
// The MIT License
// Copyright © 2020 Inigo Quilez
// Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions: The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software. THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

// Optimized linear-rgb color mix in oklab space, useful
// when our software operates in rgb space but we still
// we want to have intuitive color mixing - note the
// unexpected purples introduced when blending in rgb
// space (right columns) vs the intuitive transitions
// produced by the oklab color space (left columns).
//
// Now, when mixing linear rgb colors in oklab space, the
// linear transform from cone to Lab space and back can be
// omitted, saving three 3x3 transformation per blend!
//
// oklab was invented by Björn Ottosson: https://bottosson.github.io/posts/oklab
//
// More oklab on Shadertoy: https://www.shadertoy.com/view/WtccD7

vec3 oklab_mix( vec3 colA, vec3 colB, float h )
{
    // https://bottosson.github.io/posts/oklab
    const mat3 kCONEtoLMS = mat3(
         0.4121656120,  0.2118591070,  0.0883097947,
         0.5362752080,  0.6807189584,  0.2818474174,
         0.0514575653,  0.1074065790,  0.6302613616);
    const mat3 kLMStoCONE = mat3(
         4.0767245293, -1.2681437731, -0.0041119885,
        -3.3072168827,  2.6093323231, -0.7034763098,
         0.2307590544, -0.3411344290,  1.7068625689);

    // rgb to cone (arg of pow can't be negative)
    vec3 lmsA = pow( kCONEtoLMS*colA, vec3(1.0/3.0) );
    vec3 lmsB = pow( kCONEtoLMS*colB, vec3(1.0/3.0) );
    // lerp
    vec3 lms = mix( lmsA, lmsB, h );
    // gain in the middle (no oaklab anymore, but looks better?)
 // lms *= 1.0+0.2*h*(1.0-h);
    // cone to rgb
    return kLMStoCONE*(lms*lms*lms);
}

float cbrt(float f) {
  return pow(f, 1.0 / 3.0);
}

//====================================================


// Remaining code based on https://github.com/bottosson/bottosson.github.io/tree/f3edceaac2ff749b3ceb96804aeae9d8f818d820/misc/colorpicker

/*
Copyright (c) 2021 Björn Ottosson

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the "Software"), to deal in
the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies
of the Software, and to permit persons to whom the Software is furnished to do
so, subject to the following conditions:
The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.
THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

// Modified by Zach Capalbo 2021
// (Converted to GLSL)

float srgb_transfer_function(float a) {
    return .0031308 >= a ? 12.92 * a : 1.055 * pow(a, .4166666666666667) - .055;
}

vec3 srgb_transfer_function(vec3 a) {
  return vec3(srgb_transfer_function(a.r),srgb_transfer_function(a.g),srgb_transfer_function(a.b));
}

/* vec3 srgb_transfer_function_inv(vec3 a) {
    return .04045 < a ? pow((a + .055) / 1.055, 2.4) : a / 12.92;
} */

vec3 linear_srgb_to_oklab(vec3 c)
{
    float l = 0.4122214708f * c.r + 0.5363325363f * c.g + 0.0514459929f * c.b;
	float m = 0.2119034982f * c.r + 0.6806995451f * c.g + 0.1073969566f * c.b;
	float s = 0.0883024619f * c.r + 0.2817188376f * c.g + 0.6299787005f * c.b;

    float l_ = cbrt(l);
    float m_ = cbrt(m);
    float s_ = cbrt(s);

    return vec3(
        0.2104542553f*l_ + 0.7936177850f*m_ - 0.0040720468f*s_,
        1.9779984951f*l_ - 2.4285922050f*m_ + 0.4505937099f*s_,
        0.0259040371f*l_ + 0.7827717662f*m_ - 0.8086757660f*s_
    );
}

vec3 oklab_to_linear_srgb(vec3 c)
{
    float l_ = c.r + 0.3963377774f * c.g + 0.2158037573f * c.b;
    float m_ = c.r - 0.1055613458f * c.g - 0.0638541728f * c.b;
    float s_ = c.r - 0.0894841775f * c.g - 1.2914855480f * c.b;

    float l = l_*l_*l_;
    float m = m_*m_*m_;
    float s = s_*s_*s_;

    return vec3(
		+4.0767416621f * l - 3.3077115913f * m + 0.2309699292f * s,
		-1.2684380046f * l + 2.6097574011f * m - 0.3413193965f * s,
		-0.0041960863f * l - 0.7034186147f * m + 1.7076147010f * s
    );
}

float toe_inv(float x)
{
    const float k_1 = 0.206;
    const float k_2 = 0.03;
    const float k_3 = (1.0+k_1)/(1.0+k_2);
    return (x*x + k_1*x)/(k_3*(x+k_2));
}

float compute_max_saturation(float a, float b)
{
    // Max saturation will be when one of r, g or b goes below zero.

    // Select different coefficients depending on which component goes below zero first
    float k0, k1, k2, k3, k4, wl, wm, ws;

    if (-1.88170328 * a - 0.80936493 * b > 1.0)
    {
        // Red component
        k0 = +1.19086277; k1 = +1.76576728; k2 = +0.59662641; k3 = +0.75515197; k4 = +0.56771245;
        wl = +4.0767416621; wm = -3.3077115913; ws = +0.2309699292;
    }
    else if (1.81444104 * a - 1.19445276 * b > 1.0)
    {
        // Green component
        k0 = +0.73956515; k1 = -0.45954404; k2 = +0.08285427; k3 = +0.12541070; k4 = +0.14503204;
        wl = -1.2684380046; wm = +2.6097574011; ws = -0.3413193965;
    }
    else
    {
        // Blue component
        k0 = +1.35733652; k1 = -0.00915799; k2 = -1.15130210; k3 = -0.50559606; k4 = +0.00692167;
        wl = -0.0041960863; wm = -0.7034186147; ws = +1.7076147010;
    }

    // Approximate max saturation using a polynomial:
    float S = k0 + k1 * a + k2 * b + k3 * a * a + k4 * a * b;

    // Do one step Halley's method to get closer
    // this gives an error less than 10e6, except for some blue hues where the dS/dh is close to infinite
    // this should be sufficient for most applications, otherwise do two/three steps

    float k_l = +0.3963377774 * a + 0.2158037573 * b;
    float k_m = -0.1055613458 * a - 0.0638541728 * b;
    float k_s = -0.0894841775 * a - 1.2914855480 * b;

    {
        float l_ = 1.0 + S * k_l;
        float m_ = 1.0 + S * k_m;
        float s_ = 1.0 + S * k_s;

        float l = l_ * l_ * l_;
        float m = m_ * m_ * m_;
        float s = s_ * s_ * s_;

        float l_dS = 3.0 * k_l * l_ * l_;
        float m_dS = 3.0 * k_m * m_ * m_;
        float s_dS = 3.0 * k_s * s_ * s_;

        float l_dS2 = 6.0 * k_l * k_l * l_;
        float m_dS2 = 6.0 * k_m * k_m * m_;
        float s_dS2 = 6.0 * k_s * k_s * s_;

        float f  = wl * l     + wm * m     + ws * s;
        float f1 = wl * l_dS  + wm * m_dS  + ws * s_dS;
        float f2 = wl * l_dS2 + wm * m_dS2 + ws * s_dS2;

        S = S - f * f1 / (f1*f1 - 0.5 * f * f2);
    }

    return S;
}

vec2 find_cusp(float a, float b)
{
	// First, find the maximum saturation (saturation S = C/L)
	float S_cusp = compute_max_saturation(a, b);

	// Convert to linear sRGB to find the first point where at least one of r,g or b >= 1:
	vec3 rgb_at_max = oklab_to_linear_srgb(vec3(1.0, S_cusp * a, S_cusp * b));
	float L_cusp = cbrt(1.0 / max(max(rgb_at_max[0], rgb_at_max[1]), rgb_at_max[2]));
	float C_cusp = L_cusp * S_cusp;

	return vec2(L_cusp , C_cusp);
}


// Finds intersection of the line defined by
// L = L0 * (1 - t) + t * L1;
// C = t * C1;
// a and b must be normalized so a^2 + b^2 == 1


float find_gamut_intersection(float a, float b, float L1, float C1, float L0, vec2 cusp)
{
	// Find the intersection for upper and lower half seprately
	float t;
	if (((L1 - L0) * cusp[1] - (cusp[0] - L0) * C1) <= 0.0)
	{
		// Lower half

		t = cusp[1] * L0 / (C1 * cusp[0] + cusp[1] * (L0 - L1));
	}
	else
	{
		// Upper half

		// First intersect with triangle
		t = cusp[1] * (L0 - 1.0) / (C1 * (cusp[0] - 1.0) + cusp[1] * (L0 - L1));

		// Then one step Halley's method
		{
			float dL = L1 - L0;
			float dC = C1;

			float k_l = +0.3963377774 * a + 0.2158037573 * b;
			float k_m = -0.1055613458 * a - 0.0638541728 * b;
			float k_s = -0.0894841775 * a - 1.2914855480 * b;

			float l_dt = dL + dC * k_l;
			float m_dt = dL + dC * k_m;
			float s_dt = dL + dC * k_s;


			// If higher accuracy is required, 2 or 3 iterations of the following block can be used:
			{
				float L = L0 * (1.0 - t) + t * L1;
				float C = t * C1;

				float l_ = L + C * k_l;
				float m_ = L + C * k_m;
				float s_ = L + C * k_s;

				float l = l_ * l_ * l_;
				float m = m_ * m_ * m_;
				float s = s_ * s_ * s_;

				float ldt = 3.0 * l_dt * l_ * l_;
				float mdt = 3.0 * m_dt * m_ * m_;
				float sdt = 3.0 * s_dt * s_ * s_;

				float ldt2 = 6.0 * l_dt * l_dt * l_;
				float mdt2 = 6.0 * m_dt * m_dt * m_;
				float sdt2 = 6.0 * s_dt * s_dt * s_;

				float r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s - 1.0;
				float r1 = 4.0767416621 * ldt - 3.3077115913 * mdt + 0.2309699292 * sdt;
				float r2 = 4.0767416621 * ldt2 - 3.3077115913 * mdt2 + 0.2309699292 * sdt2;

				float u_r = r1 / (r1 * r1 - 0.5 * r * r2);
				float t_r = -r * u_r;

				float g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s - 1.0;
				float g1 = -1.2684380046 * ldt + 2.6097574011 * mdt - 0.3413193965 * sdt;
				float g2 = -1.2684380046 * ldt2 + 2.6097574011 * mdt2 - 0.3413193965 * sdt2;

				float u_g = g1 / (g1 * g1 - 0.5 * g * g2);
				float t_g = -g * u_g;

				float b = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s - 1.0;
				float b1 = -0.0041960863 * ldt - 0.7034186147 * mdt + 1.7076147010 * sdt;
				float b2 = -0.0041960863 * ldt2 - 0.7034186147 * mdt2 + 1.7076147010  * sdt2;

				float u_b = b1 / (b1 * b1 - 0.5 * b * b2);
				float t_b = -b * u_b;

				t_r = u_r >= 0.0 ? t_r : 10.0e5;
				t_g = u_g >= 0.0 ? t_g : 10.0e5;
				t_b = u_b >= 0.0 ? t_b : 10.0e5;

				t += min(t_r, min(t_g, t_b));
			}
		}
	}

	return t;
}

float find_gamut_intersection(float a, float b, float L1, float C1, float L0)
{
  // Find the cusp of the gamut triangle
  vec2 cusp = find_cusp(a, b);
  return find_gamut_intersection(a, b, L1,C1, L0, cusp);
}

vec2 get_ST_max(float a_, float b_, vec2 cusp)
{
    /* if (!cusp)
    {
        cusp = find_cusp(a_, b_);
    } */

    float L = cusp[0];
    float C = cusp[1];
    return vec2(C/L, C/(1.0-L));
}


vec3 get_Cs(float L, float a_, float b_)
{
    vec2 cusp = find_cusp(a_, b_);

    float C_max = find_gamut_intersection(a_,b_,L,1.0,L,cusp);
    vec2 ST_max = get_ST_max(a_, b_, cusp);

    float S_mid = 0.11516993 + 1.0/(
        + 7.44778970 + 4.15901240*b_
        + a_*(- 2.19557347 + 1.75198401*b_
        + a_*(- 2.13704948 -10.02301043*b_
        + a_*(- 4.24894561 + 5.38770819*b_ + 4.69891013*a_
        )))
    );

    float T_mid = 0.11239642 + 1.0/(
        + 1.61320320 - 0.68124379*b_
        + a_*(+ 0.40370612 + 0.90148123*b_
        + a_*(- 0.27087943 + 0.61223990*b_
        + a_*(+ 0.00299215 - 0.45399568*b_ - 0.14661872*a_
        )))
    );

    float k = C_max/min((L*ST_max[0]), (1.0-L)*ST_max[1]);

    float C_mid;
    {
        float C_a = L*S_mid;
        float C_b = (1.0-L)*T_mid;

        C_mid = 0.9*k*sqrt(sqrt(1.0/(1.0/(C_a*C_a*C_a*C_a) + 1.0/(C_b*C_b*C_b*C_b))));
    }

    float C_0;
    {
        float C_a = L*0.4;
        float C_b = (1.0-L)*0.8;

        C_0 = sqrt(1.0/(1.0/(C_a*C_a) + 1.0/(C_b*C_b)));
    }

    return vec3(C_0, C_mid, C_max);
}

vec3 okhsl_to_srgb(vec3 hsl)
{
  float h = hsl.r;
  float s = hsl.g;
  float l = hsl.b;
    if (l == 1.0)
    {
        return vec3(1.0,1.0,1.0);
    }

    else if (l == 0.0)
    {
        return vec3(0.0,0.0,0.0);
    }

    float a_ = cos(2.0*M_PI*h);
    float b_ = sin(2.0*M_PI*h);
    float L = toe_inv(l);

    vec3 Cs = get_Cs(L, a_, b_);
    float C_0 = Cs[0];
    float C_mid = Cs[1];
    float C_max = Cs[2];

    float C, t, k_0, k_1, k_2;
    if (s < 0.8)
    {
        t = 1.25*s;
        k_0 = 0.0;
        k_1 = 0.8*C_0;
        k_2 = (1.0-k_1/C_mid);
    }
    else
    {
        t = 5.0*(s-0.8);
        k_0 = C_mid;
        k_1 = 0.2*C_mid*C_mid*1.25*1.25/C_0;
        k_2 = (1.0 - (k_1)/(C_max - C_mid));
    }

    C = k_0 + t*k_1/(1.0-k_2*t);

    // If we would only use one of the Cs:
    //C = s*C_0;
    //C = s*1.25*C_mid;
    //C = s*C_max;

    vec3 rgb = oklab_to_linear_srgb(vec3(L, C*a_, C*b_));
    return srgb_transfer_function(rgb);
}

void main() {
  vec2 toCenter = vec2(0.5) - vUv;
  float angle = atan(toCenter.y, toCenter.x);
  float radius = length(toCenter) * 2.0;
  vec3 color = okhsl_to_srgb(vec3((angle / M_PI2) + 0.5, radius, brightness));
  gl_FragColor = vec4(color, 1.0);
}
