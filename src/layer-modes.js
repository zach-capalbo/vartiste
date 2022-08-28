const BLEND_MODES = [
  "source-over",
  "source-in",
  "source-out",
  "source-atop",

  "destination-over",
  "destination-in",
  "destination-out"

]

const COLOR_MODES = [
  "screen",
  "overlay",
  "darken",
  "lighten",
  "color-dodge",
  "color-burn",
  "soft-light",
  "hard-light",
]

const MATH_MODES = [
  "multiply",
  "difference",
  "exclusion",

  "hue",
  "saturation",
  "color",
  "luminosity",
]

const STANDARD_MODES = [
  "bumpMap",
  "displacementMap",
  "normalMap",
  "emissiveMap",
  "metalnessMap",
  "roughnessMap",
  "envMap",
  "aoMap",
  "matcap",
]

const PHYSICAL_MODES = [
  "transmissionMap",
  "clearcoatMap",
  "clearcoatNormalMap",
  "clearcoatRoughnessMap",
  "sheenColorMap"
]

const THREED_MODES = [].concat(STANDARD_MODES, PHYSICAL_MODES);

const FX = [
  'blur',
  'noise',
  "dither",
  "dilate",
  "erode",
  'flip-x',
  'flip-y',
  'grayscale-to-alpha',
  'alpha-to-grayscale',
  'invert',
  'uv-offset',
  'show-uv',
  'srgb-to-linear',
  'linear-to-srgb',
  'swizzle',
  'bump-to-normal',
  // 'oklab',
]

const BRUSH_FX = [
  'blur',
  'nudge',
  'scatter',
  'noise',
  'drip',
  'dilate',
  'hq-blending',
  // 'ryb-blend',
  'oklab-blend',
  // 'erode',
  'hq-fade',
]

const CAMERA_LAYERS = {
    DEFAULT: 0,
    LEFT_EYE: 1,
    RIGHT_EYE: 2,
    // NON_SPECTATOR: 3,
    SPECTATOR: 4,
    SPRAY_PAINT_MASK: 5,
    PROJECTOR_MASK: 6,
}

const LAYER_MODES = [].concat(BLEND_MODES, COLOR_MODES, MATH_MODES, THREED_MODES, PHYSICAL_MODES)

module.exports = {LAYER_MODES, BLEND_MODES, COLOR_MODES, MATH_MODES, THREED_MODES, FX, CAMERA_LAYERS, BRUSH_FX, PHYSICAL_MODES, STANDARD_MODES}
