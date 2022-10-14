import {Util} from './util.js'
import {BrushList} from './brush-list.js'
import {toSrcString} from './file-upload.js'
import * as Brush from './brush.js'
import shortid from 'shortid'


const BRUSH_PACKS = {}

 for (let fileName of require.context('./brush-packs/', true, /.*/).keys()) {
   let asset = fileName.slice("./".length)
   if (asset.startsWith(".")) continue;

   let assetSrc = require(`!!file-loader!./brush-packs/${asset}`)
   BRUSH_PACKS[asset] = assetSrc
 }

// The brush system is responsible for loading brushes
AFRAME.registerSystem('brush-system', {
  schema: {
    autoLoadBrushes: {default: false},
  },
  init() {
    if (this.data.autoLoadBrushes)
    {
      this.loadDefaultBrushes()
    }
    this.brushList = BrushList
    this.brusheTypes = Brush
    this.brushPacks = BRUSH_PACKS
  },
  loadDefaultBrushes() {
    BrushList.push.apply(BrushList, [
      new Brush.ImageBrush('s1', 'silky_textured', {width: 20, height: 20, autoRotate: true, hqBlending: true}),
      new Brush.ImageBrush('lines1', 'lines_condensed', {width: 20, height: 20, connected: true, dragRotate: true, tooltip: "Paint Brush", hqBlending: true}),

      new Brush.ImageBrush('lines3', 'line_grunge2', {width: 20, height: 20}),
      new Brush.ImageBrush('dots1', 'dots', {width: 20, height: 20, autoRotate: true, drawEdges: false}),
      new Brush.StretchBrush('stretch_pencil3',"pencil2", {tooltip: "Pencil Line", textured: false, switchbackAngle: 90}),
      new Brush.StretchBrush('stretch_thick',"thick_paint", {tooltip: "Thick Paint", textured: true, switchbackAngle: 100}),
      new Brush.StretchBrush('stretch_leaf',"stamp_leaf1", {tooltip: "Leaf", textured: true}),
      
      new Brush.LambdaBrush('square', {connected: true, drawEdges: true, hqBlending: true, tooltip: "Square"}, (ctx, {width, height}) => { ctx.fillRect(0,0,width,height)  }),
      new Brush.ProceduralBrush('charcoal1', {connected: true, hqBlending: 'always', minMovement: 1.3, invertScale: true, opacityScale: 0.3, tooltip: "Charcoal Stick"}),
      new Brush.StretchBrush('stretch_pencil',"pencil-stroke", {tooltip: "Pencil Stroke", textured: false}),
      
      new Brush.FxBrush('blur1', {baseBrush: new Brush.ProceduralBrush('', {connected: true, hqBlending: false}), type: 'blur', previewSrc: require('./assets/blur-preview.png')}),
      new Brush.FillBrush('fill1'),
      new Brush.FxBrush('nudeg2', {baseBrush: new Brush.ImageBrush('', 'lines2', {width: 40, height: 20, connected: true}), dragRotate: true, type: 'nudge', previewSrc: require('./assets/nudge-brush.png')}),
      new Brush.LineBrush('straight', {tooltip: "Straight Line"}),
      new Brush.FillShapeBrush('fill_shape', {tooltip: "Fill Shape", previewSrc: require('./assets/transition-masked.png')}),
      
      new Brush.LambdaBrush('lines5', {connected: true, drawEdges: true, hqBlending: true, tooltip: "Vertical Line"}, (ctx, {width, height}) => {
        ctx.beginPath()
        ctx.moveTo(width / 2, 0)
        ctx.lineTo(width / 2, height)
        ctx.stroke()
      }),
      new Brush.ImageBrush('diamond', 'diamond', {width: 20, height: 20, connected: true, hqBlending: true}),
      new Brush.FillBrush('fill2', {mode: "source-atop", previewSrc: require('./assets/masked-bucket.png')}),
      new Brush.FxBrush('scatter', {baseBrush: new Brush.ImageBrush('s1', 'silky_textured', {width: 20, height: 20, autoRotate: true}), type: 'scatter'}),
      new Brush.NoiseBrush('noise1', {hidden: true}),
      new Brush.FxBrush('noise2', {baseBrush: new Brush.ProceduralBrush('', {connected: true, hqBlending: false}), type: 'noise', previewSrc: require('./assets/dice-6.png')}),
      new Brush.ProceduralBrush('eraser', {connected: true, hqBlending: false, tooltip: "Default", mode: 'destination-out', tooltip: 'Eraser'}),
      
      new Brush.FxBrush('nudge1', {baseBrush: new Brush.ProceduralBrush('', {connected: true, hqBlending: false}), dragRotate: true, type: 'nudge', previewSrc: require('./assets/nudge-brush.png')}),
      new Brush.StretchBrush('stretch_line_grunge1',"line_grunge1", {tooltip: "Grunge"}),
      new Brush.StretchBrush('stretch_lines1',"silky_textured", {tooltip: "Silky", textured: true}),
      new Brush.StretchBrush('stretch_ink',"ink", {tooltip: "Ink", textured: false}),
      new Brush.StretchBrush('stretch_water2',"watercolor", {tooltip: "Watercolor", textured: false, switchbackAngle: 90}),
      new Brush.StretchBrush('stretch_pencil2',"pencil-line", {tooltip: "Crayon", textured: false, switchbackAngle: 90}),
      
      new Brush.ProceduralBrush('p1', {width: 20, height: 20, hardness: 0.9, connected: true, hqBlending: true, tooltip: "Hard"}),
      new Brush.ImageBrush('s2', 'silky_textured', {textured: true, width: 64, height:16}),
      new Brush.ImageBrush('lines2', 'lines_condensed1', {width: 20, height: 20, connected: true, dragRotate: true, textured: true}),
      new Brush.ImageBrush('lines4', 'line_grunge1', {width: 64, height: 16, textured: true}),
      
      new Brush.FloodFillBrush('flood_fill', "flood"),
      // new Brush.FxBrush('oklab', {baseBrush: new Brush.ProceduralBrush('', {connected: true, hqBlending: false}), type: 'oklab-blend', previewSrc: require('./assets/blur-preview.png')}),
    //  new Brush.StretchBrush('stretch_grass',"grass", {tooltip: "Thick Paint", textured: true}),
    // new Brush.VectorBrush('vector'),


    // Hidden Brushes
    new Brush.ProceduralBrush('charcoal2', {connected: true, hqBlending: 'always', minMovement: 0.5, tooltip: "Charcoal Pencil", hidden: true}),
    new Brush.ImageBrush('cloth1', 'cloth', {widht: 48, height: 48, drawEdges: true, tooltip: "Hatches", hidden: true}),
    ].filter(b => !b.invalid))
  },
  addUserBrushes(brushes) {
    let brushShelf = document.querySelector('*[brush-shelf]') ?
                        document.querySelector('*[brush-shelf]').components['brush-shelf']
                        : null

    if (!brushShelf) return;

    for (let b of brushes) {
      brushShelf.addBrush(Brush.Brush.fullRestore(b))
    }
  },
  loadPack(fileKey) {
    if (!BRUSH_PACKS[fileKey]) {
      console.warn("No such brush pack", fileKey)
      return
    }

    console.log("Loading pack", fileKey, BRUSH_PACKS[fileKey])

    this.sceneEl.systems['file-upload'].handleURL(BRUSH_PACKS[fileKey])
  }
})

AFRAME.registerComponent('brush-editor', {
  schema: {
    type: {oneOf: ['ImageBrush', 'StretchBrush', 'FxBrush'], default: 'ImageBrush'},

    name: {default: "New Brush"},

    // Common
    textured: {default: false, passthrough: true},
    mode: {default: 'source-over', passthrough: true},

    fx: {default: "scatter"},

    // ImageBrush
    connected: {default: true, passthrough: true},
    autoRotate: {default: false, passthrough: true},
    dragRotate: {default: true, passthrough: true},
    hqBlending: {default: false, passthrough: true},

    requireMovement: {default: false},
  },
  events: {
    componentchanged: function(e) {
      if (e.detail.name === 'visible')
      {
        if (this.el.getAttribute('visible'))
        {
          this.el.sceneEl.systems['file-upload'].fileInterceptors.push(this.interceptFile)
          this.useBrush(this.el.sceneEl.systems['paint-system'].brush)
        }
        else
        {
          this.el.sceneEl.systems['file-upload'].fileInterceptors.splice(this.el.sceneEl.systems['file-upload'].fileInterceptors.indexOf(this.interceptFile), 1)
        }
      }
    },
    click: function(e) {
      if (e.target.hasAttribute('click-action'))
      {
        this[e.target.getAttribute('click-action')](e)
        e.stopPropagation()
        return true;
      }
      else if (e.target.hasAttribute('layer-mode'))
      {
        this.el.setAttribute('brush-editor', 'mode', e.target.getAttribute('layer-mode'))
        e.target.emit('popupaction', 'close')
      }
    }
  },
  init() {
    this.interceptFile = this.interceptFile.bind(this)

    Util.whenLoaded(this.el.sceneEl, () => {
      let img = new Image();
      img.src = BrushList[0].previewSrc
      this.setImage(img)
      if (this.el.getAttribute('visible'))
      {
        this.el.sceneEl.systems['file-upload'].fileInterceptors.push(this.interceptFile)
      }
    })

    this.el.sceneEl.addEventListener('brushchanged', (e) => {
      if (!this.el.getAttribute('visible')) return;
      let brush = e.detail.brush
      this.useBrush(brush)
    })
  },
  interceptFile(items)
  {
    for (let i = 0; i < items.length; ++i)
    {
      let item = items[i];
      if (item.kind && item.kind !== 'file') continue
      let file = (item instanceof File) ? item : item.getAsFile()
      let isImage = item.type ? /image\//.test(item.type) : /\.(png|jpg|jpeg|bmp|svg)$/i.test(file.name)
      if (!isImage) continue;

      let img = new Image()
      new Promise(r => {
        img.onload = r
        img.src = toSrcString(file)
      }).then(() => {
        this.setImage(img)
      })

      items.splice(i, 1)
      return true
    }
    return false
  },
  useCanvas() {
    let img = new Image();
    Compositor.component.quickDraw()
    img.src = Compositor.component.preOverlayCanvas.toDataURL()
    this.setImage(img);
  },
  useLayer() {
    let img = new Image();
    img.src = Util.autoCropCanvas(Compositor.drawableCanvas).toDataURL()
    this.setImage(img)
  },
  useBrush(brush) {
    if (brush.previewSrc instanceof Image)
    {
      if (brush.previewSrc.src.startsWith('blob:') || brush.previewSrc.src.startsWith('http'))
      {
        let img = new Image();
        img.src = brush.previewSrc.src
        img.src = Util.cloneCanvas(img).toDataURL()
        img.width = brush.previewSrc.width
        img.height = brush.previewSrc.height
        this.setImage(img)
      }
      else
      {
        this.setImage(brush.previewSrc)
      }
    }
    else
    {
      let img = new Image();
      img.src = brush.previewSrc
      this.setImage(img)
    }
  },
  setImage(img) {
    console.log("Setting image")
    this.image = img
    this.el.querySelector('.preview').setAttribute('material', 'src', img)
  },
  update(oldData) {
    this.el.querySelectorAll('.image-brush, .stretch-brush, .fx-brush').forEach(el => el.setAttribute('visible', false))
    let brushClass = '.' + this.data.type.replace( /(?!^)([A-Z])/g, "-$1").toLowerCase()
    this.el.querySelectorAll(brushClass).forEach(el => el.setAttribute('visible', true))
  },
  createBrush() {
    if (!this.image) {
      console.warn("Cannot create brush. No image set");
      return;
    }
    let opts = {}
    for (let [opt, value] of Object.entries(this.schema))
    {
      if (!value.passthrough) continue
      opts[opt] = this.data[opt]
    }

    if (this.data.requireMovement)
    {
      opts.minMovement = 1.0
    }

    // this.image.width = 64
    // this.image.height = 64
    if (this.image.width > this.image.height)
    {
      opts.width = 24
      opts.height = 24 * this.image.height / this.image.width
    }
    else
    {
      opts.height = 24
      opts.width = 24 * this.image.width / this.image.height
    }

    let brush;
    if (this.data.type === 'FxBrush')
    {
      opts.baseBrush = new Brush.ImageBrush(shortid.generate(), this.image, opts)
      opts.type = this.data.fx
      brush = new Brush[this.data.type](shortid.generate(), opts)
    }
    else
    {
      brush = new Brush[this.data.type](shortid.generate(), this.image, opts)
    }
    brush.user = true
    return brush
  },
  addBrush() {
    let brush = this.createBrush()
    document.querySelector('*[brush-shelf]').components['brush-shelf'].addBrush(brush)
    this.el.sceneEl.systems['paint-system'].selectBrush(BrushList.length - 1)
  },
  saveAll() {
    let brushes = []
    for (let brush of BrushList) {
      if (!brush.user) continue;
      if (brush.deleted) continue;
      brushes.push(brush.fullStore())
    }
    let encoded = JSON.stringify(brushes)
    this.el.sceneEl.systems['settings-system'].downloadCompressed(encoded, {extension: "vartiste-brushez"}, "User created brushes")
  },
  deleteBrush() {
    let brush = this.el.sceneEl.systems['paint-system'].brush
    if (!brush.user) return

    let idx = BrushList.indexOf(brush)
    if (idx < 0) return;

    let brushShelf = document.querySelector('*[brush-shelf]').components['brush-shelf'];

    brush.deleted = true
    if (idx === BrushList.length - 1)
    {
      brushShelf.deleteLastBrush()
    }
    else
    {
      brushShelf.hideBrushAt(idx)
    }
  }
})
