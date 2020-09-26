import {ProceduralBrush, ImageBrush, LambdaBrush, FillBrush, NoiseBrush, FxBrush, LineBrush, StretchBrush} from './brush.js'
const BrushList = [
  new ProceduralBrush('default', {connected: true, hqBlending: true, tooltip: "Default"}),
  new ImageBrush('s1', 'silky_textured', {width: 20, height: 20, autoRotate: true}),
  new ImageBrush('s2', 'silky_textured', {textured: true, width: 64, height:16}),
  new ProceduralBrush('p1', {width: 20, height: 20, hardness: 0.9, connected: true, hqBlending: true, tooltip: "Hard"}),
  new ImageBrush('lines1', 'lines_condensed', {width: 20, height: 20, connected: true, dragRotate: true, tooltip: "Paint Brush"}),
  new ImageBrush('lines2', 'lines_condensed1', {width: 20, height: 20, connected: true, dragRotate: true, textured: true}),
  new ImageBrush('lines3', 'line_grunge2', {width: 20, height: 20}),
  new ImageBrush('lines4', 'line_grunge1', {width: 64, height: 16, textured: true}),
  new ImageBrush('dots1', 'dots', {width: 20, height: 20, autoRotate: true, drawEdges: false}),
  new LambdaBrush('lines5', {connected: true, drawEdges: true, hqBlending: true, tooltip: "Vertical Line"}, (ctx, {width, height}) => {
    ctx.beginPath()
    ctx.moveTo(width / 2, 0)
    ctx.lineTo(width / 2, height)
    ctx.stroke()
  }),
  new LambdaBrush('square', {connected: true, drawEdges: true, hqBlending: true, tooltip: "Square"}, (ctx, {width, height}) => { ctx.fillRect(0,0,width,height)  }),
  new ImageBrush('diamond', 'diamond', {width: 20, height: 20, connected: true, hqBlending: true}),
  new FillBrush('fill1'),
  new FillBrush('fill2', {mode: "source-atop", previewSrc: require('./assets/masked-bucket.png')}),
  new NoiseBrush('noise1'),
  new NoiseBrush('noise2', {round: true}),
  new ImageBrush('cloth1', 'cloth', {widht: 48, height: 48, drawEdges: true, tooltip: "Hatches"}),
  new FxBrush('blur1', {baseBrush: new ProceduralBrush('', {connected: true, hqBlending: false}), type: 'blur', previewSrc: require('./assets/blur-preview.png')}),
  new FxBrush('nudge1', {baseBrush: new ProceduralBrush('', {connected: true, hqBlending: false}), dragRotate: true, type: 'nudge', previewSrc: require('./assets/nudge-brush.png')}),
  new FxBrush('nudeg2', {baseBrush: new ImageBrush('', 'lines2', {width: 40, height: 20, connected: true}), dragRotate: true, type: 'nudge', previewSrc: require('./assets/nudge-brush.png')}),
  new ProceduralBrush('charcoal1', {connected: true, hqBlending: 'always', minMovement: 1.3, invertScale: true, tooltip: "Charcoal Stick"}),
  new ProceduralBrush('charcoal2', {connected: true, hqBlending: 'always', minMovement: 0.5, tooltip: "Charcoal Pencil"}),
  new LineBrush('straight', {tooltip: "Straight Line"}),
  new StretchBrush('stretch_line_grunge1',"line_grunge1", {tooltip: "StretchBrush Line"}),
  new StretchBrush('stretch_lines1',"silky_textured", {tooltip: "StretchBrush Line", textured: true}),
  new StretchBrush('stretch_leaf',"stamp_leaf1", {tooltip: "StretchBrush Line", textured: true}),
  new StretchBrush('stretch_ink',"ink", {tooltip: "StretchBrush Line", textured: false}),
  new StretchBrush('stretch_thick',"thick_paint", {tooltip: "StretchBrush Line", textured: true}),
  new StretchBrush('stretch_water2',"watercolor", {tooltip: "StretchBrush Line", textured: false}),
  new StretchBrush('stretch_pencil',"pencil-stroke", {tooltip: "StretchBrush Line", textured: false}),
]

export { BrushList }
