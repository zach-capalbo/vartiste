import {ProceduralBrush, ImageBrush, LambdaBrush, FillBrush, NoiseBrush, FxBrush, LineBrush, StretchBrush} from './brush.js'
const BrushList = [
  new ProceduralBrush('default', {connected: true, hqBlending: true, tooltip: "Default"}),
]

export { BrushList }
