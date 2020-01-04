import {ProceduralBrush, ImageBrush} from './brush.js'
const BrushList = [
  new ProceduralBrush(),
  new ImageBrush('silky_textured', {width: 20, height: 20}),
  new ImageBrush('silky_textured', {textured: true, width: 64, height:16}),
  new ProceduralBrush({width: 20, height: 20, hardness: 0.9}),
  new ImageBrush('lines2', {width: 20, height: 20}),
  new ImageBrush('line_grunge2', {width: 20, height: 20}),
  new ImageBrush('line_grunge1', {width: 64, height: 16, textured: true}),
]

export { BrushList }
