import shortid from 'shortid'
import {THREED_MODES} from "./layer-modes.js"

export class Layer {
  constructor(width, height) {
    this.width = width
    this.height = height

    if (!(Number.isInteger(width) && width > 0)) throw new Error(`Invalid layer width ${width}`)
    if (!(Number.isInteger(height) && height > 0)) throw new Error(`Invalid layer width ${height}`)

    this.transform = this.constructor.EmptyTransform()
    this.mode = "source-over"
    this.visible = true
    this.active = false
    this.grabbed = false
    this.opacity = 1.0
    this.id = shortid.generate()

    let canvas = document.createElement("canvas")
    canvas.width = this.width
    canvas.height = this.height
    canvas.id = `layer-${this.id}`
    document.body.append(canvas)
    this.canvas = canvas;
    document.body.append(canvas)

    this.clear()
  }

  draw(ctx, frame=0, {mode} = {}) {
    if (typeof mode === 'undefined') mode = this.mode
    ctx.save()
    ctx.globalCompositeOperation = mode
    ctx.globalAlpha = this.opacity
    let {translation, scale} = this.transform
    try {
    let canvas = this.frame(frame)
    ctx.drawImage(canvas, 0, 0, this.width, this.height,
      translation.x - this.width / 2 * scale.x + this.width / 2,
      translation.y- this.height / 2 * scale.y + this.height / 2,
      this.width * scale.x, this.height * scale.y,
    )
    }
    catch (e)
    {
      console.warn(frame % this.frames.length, this.frames[frame % this.frames.length])
      console.error(e)
    }

    // ctx.translate(translation.x + this.width / 2, translation.y + this.height / 2)
    // ctx.scale(scale.x, scale.y)
    // ctx.rotate(this.transform.rotation)
    // ctx.drawImage(this.canvas, -this.width / 2, -this.height / 2)
    ctx.restore()
  }

  clear() {
    let ctx = this.canvas.getContext('2d');
    ctx.clearRect(0, 0, this.width, this.height)
    this.frames = [this.canvas]
  }

  resize(width, height) {
    this.canvas.width = width
    this.canvas.height = height
    this.width = width
    this.height = height
  }

  insertFrame(position, {canvas} = {}) {
    if (typeof canvas === 'undefined') canvas = document.createElement('canvas')
    canvas.width = this.width
    canvas.height = this.height
    this.frames.splice(position + 1, 0, canvas)
  }

  deleteFrame(position) {
    this.frames.splice(position, 1)
  }

  frameIdx(idx) {
    idx = idx % this.frames.length
    if (idx < 0) idx = this.frames.length + idx
    return idx
  }

  frame(idx) {
    return this.frames[this.frameIdx(idx)]
  }

  static EmptyTransform() {
    return {
      translation: {x: 0,y: 0},
      scale: {x: 1,y: 1},
      rotation: 0.0
    }
  }
}

export class LayerNode {
  constructor(compositor) {
    this.id = shortid.generate()
    this.compositor = compositor
    this.compositor.allNodes.push(this)

    this.transform = Layer.EmptyTransform()
    this.grabbed = false
    this.opacity = 1.0
    this.id = shortid.generate()

    this.canvas = document.createElement('canvas')
    this.canvas.width = compositor.width
    this.canvas.height = compositor.height

    this.mode = 'source-over'
    this.sources = []
    this.shelfMatrix = new THREE.Matrix4()
  }

  toJSON() {
    let json = Object.assign({}, this)
    json.compositor = undefined
    json.canvas = undefined
    json.sources = undefined
    json.destination = undefined
    json.type = this.constructor.name
    json.connections = this.getConnections().map(c => {c.to=c.to ? c.to.id : undefined; return c})
    return json
  }

  getConnections() {
    return [
      {type: 'destination', to: this.destination, index: 0}
    ].concat(this.sources.map((s, i) => {
      return {type: 'source', index: i, to: s}
    }))
  }

  connectInput(layer, {type, index}) {
    if (type === "source") {
      this.sources[index] = layer
    }
    else if (type == "destination")
    {
      this.connectDestination(layer)
    }
  }
  disconnectInput({type, index}) {
    if (type === 'source') {
      this.sources[index] = undefined
    }
    else if (type === 'destination')
    {
      this.disconnectDestination()
    }
  }
  connectDestination(layer) {
    this.destination = layer
  }
  disconnectDestination()
  {
    this.destination = undefined
    let ctx = this.canvas.getContext('2d')
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
  }
  updateCanvas(frame) {
    if (!this.destination) return
    let ctx = this.canvas.getContext('2d')
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
    this.destination.draw(ctx, frame, {mode: 'copy'})

    for (let source of this.sources)
    {
      if (!source) continue
      source.draw(ctx, frame, {mode: this.mode})
    }
  }
  draw(ctx, frame, {mode} = {}) {
    if (typeof mode === 'undefined') mode = 'source-over'
    this.updateCanvas(frame)
    ctx.globalCompositeOperation = mode
    ctx.globalAlpha = this.opacity
    let {translation, scale} = this.transform
    let {width, height} = this.canvas
    let canvas = this.canvas
    ctx.drawImage(canvas, 0, 0, width, height,
      translation.x - width / 2 * scale.x + width / 2,
      translation.y- height / 2 * scale.y + height / 2,
      width * scale.x, height * scale.y,
    )
  }
}

export class MaterialNode extends LayerNode{
  constructor(compositor) {
    super(compositor)
    this.inputs = {}
  }
  toJSON() {
    let json = super.toJSON()
    json.inputs = undefined
    return json
  }
  getConnections() {
    let connections = []

    for (let type in this.inputs)
    {
      connections.push({type, to: this.inputs[type], index: 0})
    }

    return connections
  }
  connectInput(layer, {type, index}) {
    this.inputs[type] = layer
  }
  disconnectInput({type, index}) {
    delete this.inputs[type]
  }
}
