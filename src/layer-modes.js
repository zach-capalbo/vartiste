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

const THREED_MODES = [
  "bumpMap",
  "displacementMap",
  "normalMap",
  "emissiveMap",
  "metalnessMap",
  "roughnessMap"
]

const LAYER_MODES = [].concat(BLEND_MODES, COLOR_MODES, MATH_MODES, THREED_MODES)

module.exports = {LAYER_MODES, BLEND_MODES, COLOR_MODES, MATH_MODES, THREED_MODES}