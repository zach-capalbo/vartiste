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
    this.shelfMatrix = new THREE.Matrix4()

    this.needsUpdate = false

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

export class CanvasNode {
  constructor(compositor, {useCanvas = true} = {}) {
    this.id = shortid.generate()
    this.compositor = compositor
    this.compositor.allNodes.push(this)

    this.needsUpdate = false

    this.transform = Layer.EmptyTransform()
    this.grabbed = false
    this.opacity = 1.0
    this.id = shortid.generate()

    if (useCanvas)
    {
      this.canvas = document.createElement('canvas')
      this.canvas.width = compositor.width
      this.canvas.height = compositor.height
    }

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
    })).filter(s => s.to)
  }

  resize(width, height) {
    if (!this.canvas) return
    this.canvas.width = width
    this.canvas.height = height
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
    if (this.canvas)
    {
      let ctx = this.canvas.getContext('2d')
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
    }
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

export class MaterialNode extends CanvasNode {
  constructor(compositor) {
    super(compositor, {useCanvas: false})
    this.inputs = {}
  }
  toJSON() {
    let json = super.toJSON()
    json.inputs = undefined
    return json
  }
  updateCanvas() {}
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

export class PassthroughNode extends CanvasNode {
  constructor(compositor) {
    super(compositor, {useCanvas: false})
  }
  updateCanvas() {}
  draw(...args) {
    if (!this.destination) return
    this.destination.draw(...args)
  }
}

export class FxNode extends CanvasNode {
  constructor(compositor, {shader = "blur", ...opts} = {}) {
    super(compositor, opts)
    Object.defineProperty(this, "glData", {enumerable: false, value: {}})
    this.shader = shader
  }
  disconnectDestination()
  {
    this.destination = undefined
  }
  changeShader(shader) {
    this.shader = shader

    if (this.glData.program)
    {
      let gl = this.canvas.getContext('webgl')
      gl.deleteProgram(this.glData.program)
      delete this.glData.program
    }
  }
  createShader(gl, type, source) {
    let shader = gl.createShader(type)
    gl.shaderSource(shader, source)
    gl.compileShader(shader)
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
    {
      throw new Error(gl.getShaderInfoLog(shader));
    }

    return shader
  }
  getProgram(gl) {
    if (this.glData.program)
    {
      return this.glData.program
    }
    let vertexShader = this.createShader(gl, gl.VERTEX_SHADER, require('./shaders/fx-uv-passthrough.vert'))
    let fragmentShader = this.createShader(gl, gl.FRAGMENT_SHADER, require(`./shaders/fx/${this.shader}.glsl`))

    let program = gl.createProgram()
    gl.attachShader(program, vertexShader)
    gl.attachShader(program, fragmentShader)
    gl.linkProgram(program)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS))
    {
      throw new Error(gl.getProgramInfoLog(program))
    }
    gl.useProgram(program);
    this.glData.program = program
    return this.glData.program
  }
  setupTexture(gl, frame) {
    let program = this.getProgram(gl)

    if (!this.glData.texture)
    {
      this.glData.texture = gl.createTexture()
    }

    if (this.destination.updateCanvas) this.destination.updateCanvas(frame)
    let textureCanvas = this.destination.frame ? this.destination.frame(frame) : this.destination.canvas
    if (!textureCanvas)
    {
      throw new Error("No canvas")
    }

    gl.activeTexture(gl.TEXTURE0 + 0);
    gl.bindTexture(gl.TEXTURE_2D, this.glData.texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, textureCanvas);
    // Set the parameters so we can render any size image.
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

   var location = gl.getUniformLocation(program, "u_input");
   gl.uniform1i(location, 0);

   this.setProgramUniform("u_width", "uniform1f", textureCanvas.width)
   this.setProgramUniform("u_height", "uniform1f", textureCanvas.height)
  }
  setProgramUniform(name, type, value){
    let program = this.glData.program
    let location = this.glData.gl.getUniformLocation(program, name)
    if (location)
    {
      if (typeof value === 'function') value = value()
      this.glData.gl[type](location, value)
    }
  }
  updateCanvas(frame) {
    if (!this.destination) return
    let canvas = this.canvas

    let gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
    this.glData.gl = gl

    gl.viewport(0, 0,
    gl.drawingBufferWidth, gl.drawingBufferHeight);
    gl.clearColor(0.0, 0.0, 0.0, 0.0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    let program = this.getProgram(gl)

    let positionAttributeLocation = gl.getAttribLocation(program, "a_position");
    let positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    var positions = [
      -1, -1,
      1, -1,
      1, 1,
      1, 1,
      -1, 1,
      -1, -1
    ];
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

    this.setupTexture(gl, frame)

    gl.enableVertexAttribArray(positionAttributeLocation);
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);

    // Tell the attribute how to get data out of positionBuffer (ARRAY_BUFFER)
    var size = 2;          // 2 components per iteration
    var type = gl.FLOAT;   // the data is 32bit floats
    var normalize = false; // don't normalize the data
    var stride = 0;        // 0 = move forward size * sizeof(type) each iteration to get the next position
    var offset = 0;        // start at the beginning of the buffer
    gl.vertexAttribPointer(
        positionAttributeLocation, size, type, normalize, stride, offset)

        var primitiveType = gl.TRIANGLES;
    var offset = 0;
    var count = 6;
    gl.drawArrays(primitiveType, offset, count);
  }
}
