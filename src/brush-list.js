import {ProceduralBrush, ImageBrush, LambdaBrush, FillBrush, GradientBrush} from './brush.js'
const BrushList = [
  new ProceduralBrush({connected: true, autoRotate: true, dithered: true}),
  new GradientBrush({connected: true}),
  new ImageBrush('silky_textured', {width: 20, height: 20, autoRotate: true}),
  new ImageBrush('silky_textured', {textured: true, width: 64, height:16}),
  new ProceduralBrush({width: 20, height: 20, hardness: 0.9, connected: true}),
  new ImageBrush('lines2', {width: 20, height: 20, connected: true}),
  new ImageBrush('line_grunge2', {width: 20, height: 20}),
  new ImageBrush('line_grunge1', {width: 64, height: 16, textured: true}),
  new ImageBrush('dots', {width: 20, height: 20, autoRotate: true}),
  new LambdaBrush({connected: true}, (ctx, {width, height}) => {
    ctx.beginPath()
    ctx.moveTo(width / 2, 0)
    ctx.lineTo(width / 2, height)
    ctx.stroke()
  }),
  new LambdaBrush({connected: true}, (ctx, {width, height}) => { ctx.fillRect(0,0,width,height)  }),
  new ImageBrush('diamond', {width: 20, height: 20, connected: true}),
  new FillBrush(),
  new FillBrush({mode: "source-atop", previewSrc: require('./assets/masked-bucket.png')})
]

export { BrushList }
