import {ProceduralBrush, ImageBrush} from './brush.js'
const BrushList = [
  new ProceduralBrush(),
  new ImageBrush('silky_textured', {width: 20, height: 20}),
  new ImageBrush('silky_textured', {textured: true}),
]

export { BrushList }
