import shortid from 'shortid'
import {THREED_MODES} from "./layer-modes.js"
import {CanvasShaderProcessor} from "./canvas-shader-processor.js"

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

    this.updateTime = 0

    let canvas = document.createElement("canvas")
    canvas.width = this.width
    canvas.height = this.height
    canvas.id = `layer-${this.id}`
    document.body.append(canvas)
    this.canvas = canvas;
    this.canvas.touch = () => this.touch()
    this.canvas.getUpdateTime = () => this.updateTime

    this.clear()
  }
  touch() {
    this.updateTime = document.querySelector('a-scene').time
  }
  draw(ctx, frame=0, {mode} = {}) {
    if (typeof mode === 'undefined') mode = this.mode
    ctx.save()
    ctx.globalCompositeOperation = mode
    ctx.globalAlpha = this.opacity
    let {translation, scale} = this.transform
    try {
    let canvas = this.frame(frame)
    // ctx.drawImage(canvas, 0, 0, this.width, this.height,
    //   translation.x - this.width / 2 * scale.x + this.width / 2,
    //   translation.y- this.height / 2 * scale.y + this.height / 2,
    //   this.width * scale.x, this.height * scale.y,
    // )
    ctx.translate(translation.x + this.width / 2, translation.y + this.height / 2)
    ctx.scale(scale.x, scale.y)
    ctx.rotate(this.transform.rotation)
    ctx.drawImage(canvas, -this.width / 2, -this.height / 2)
    }
    catch (e)
    {
      console.warn(frame % this.frames.length, this.frames[frame % this.frames.length])
      console.error(e)
    }


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
    canvas.touch = () => this.updateTime = document.querySelector('a-scene').time
    canvas.getUpdateTime = () => this.updateTime
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

    this.updateTime = 0

    this.transform = Layer.EmptyTransform()
    this.grabbed = false
    this.opacity = 1.0
    this.id = shortid.generate()

    if (useCanvas)
    {
      this.canvas = document.createElement('canvas')
      this.canvas.width = compositor.width
      this.canvas.height = compositor.height
      this.canvas.touch = () => this.touch()
      this.canvas.getUpdateTime = () => this.updateTime
    }

    this.mode = 'source-over'
    this.sources = []
    this.shelfMatrix = new THREE.Matrix4()
  }
  touch() {
    this.updateTime = 0
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
    this.touch()
    if (type === "source") {
      this.sources[index] = layer
    }
    else if (type == "destination")
    {
      this.connectDestination(layer)
    }
  }
  disconnectInput({type, index}) {
    this.touch()
    if (type === 'source') {
      this.sources[index] = undefined
    }
    else if (type === 'destination')
    {
      this.disconnectDestination()
    }
  }
  connectDestination(layer) {
    this.touch()
    this.destination = layer
  }
  disconnectDestination()
  {
    this.touch()
    this.destination = undefined
    if (this.canvas)
    {
      let ctx = this.canvas.getContext('2d')
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
    }
  }
  checkIfUpdateNeeded(frame) {
    // if (typeof frame === 'undefined') throw new Error(`Missing frame ${this.constructor.name}`)
    let needsUpdate = false

    for (let node of this.sources.concat(this.destination))
    {
      if (!node) continue
      if (node.updateCanvas) node.updateCanvas(frame)
      if (node.frameIdx && node.updateFrame !== node.frameIdx(frame)) {
        // console.log(`Frame update ${node.constructor.name}`, frame, node.frameIdx(frame), node.updateFrame)
        needsUpdate = true
      }
      if (node.updateTime >= this.updateTime) needsUpdate = true
    }

    return needsUpdate
  }
  updateCanvas(frame) {
    if (!this.destination) return

    if (!this.checkIfUpdateNeeded(frame)) return

    this.updateTime = document.querySelector('a-scene').time

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
  touch() {
    console.log("Touch MaterialNode", this.updateTime, Compositor.component.drawnT)
    this.updateTime = Compositor.component.drawnT + 0.01
  }
  toJSON() {
    let json = super.toJSON()
    json.inputs = undefined
    return json
  }
  updateCanvas(frame) {
    let needsUpdate = false

    for (let node of Object.values(this.inputs))
    {
      if (node.updateCanvas) node.updateCanvas(frame)
      if (node.updateTime >= this.updateTime) needsUpdate = true
    }

    if (!needsUpdate) return

    // this.updateTime = document.querySelector('a-scene').time
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
    this.touch()
    this.inputs[type] = layer
  }
  disconnectInput({type, index}) {
    this.touch()
    delete this.inputs[type]
  }
}

export class PassthroughNode extends CanvasNode {
  constructor(compositor) {
    super(compositor, {useCanvas: false})
  }
  updateCanvas(frame) {
    if (!this.destination) return
    if (this.destination.updateCanvas) this.destination.updateCanvas(frame)
    this.updateTime = this.destination.updateTime
  }
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
  touch() {
    this.updateTime = 0
  }
  changeShader(shader) {
    this.touch()
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

   for (let i in this.sources)
   {
     let source = this.sources[i]
     if (!source) continue
     if (source.updateCanvas) source.updateCanvas(frame)
   }
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

    if (!this.checkIfUpdateNeeded(frame)) return

    this.updateTime = document.querySelector('a-scene').time

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

export class OutputNode extends MaterialNode {
  constructor(compositor) {
    super(compositor)
    this.name = this.id
    this.solo = false
  }
}

export class GroupNode extends PassthroughNode {
  constructor(compositor) {

  }
}

export class NetworkInputNode extends CanvasNode {
  constructor(...opts) {
    super(...opts)

    this._name = this.id

    Object.defineProperty(this, "networkData", {enumerable: false, value: {}})

    this.networkData.alphaProcessor = new CanvasShaderProcessor({fx: 'grayscale-to-alpha'})
    this.networkData.needsConnection = true
  }
  get needsConnection() { return this.networkData.needsConnection }
  get name() {
    return this._name
  }
  set name(name) {
    console.log("Set name")
    if (name !== this._name)
    {
      if (this.networkData.peer)
      {
        this.networkData.peer.destroy
      }
      this._name = name
      this.connectNetwork()
    }
  }
  get receivingBroadcast()
  {
    return !!this.networkData.video
  }
  connectNetwork()
  {
    this.networkData.needsConnection = false
    this.compositor.el.sceneEl.systems['networking'].callFor(this._name,
      {
        onvideo: (video) => this.networkData.video = video,
        onalpha: (video) => this.networkData.alphaVideo = video,
        onpeer: (peer) => this.networkData.peer = peer,
        onerror: (error) => {
          console.log("Clearing receive layer", this.name)
          delete this.networkData.video
          delete this.networkData.alphaVideo
          this.networkData.peer.destroy()
          delete this.networkData.peer
          this.networkData.needsConnection = true
        }
      })
  }
  updateCanvas(frame) {
    if (!this.video) return

    this.updateTime = document.querySelector('a-scene').time

    if (this.canvas.width !== this.networkData.video.width || this.canvas.height !== this.networkData.video.height)
    {
      this.canvas.width = this.networkData.video.videoWidth
      this.canvas.height = this.networkData.video.videoHeight
    }

    this.video.width = this.networkData.video.videoWidth
    this.video.height = this.networkData.video.videoHeight

    if (this.canvas.width === 0 || this.canvas.height === 0)
    {
      this.canvas.width = 10
      this.canvas.height = 10
      return
    }

    let ctx = this.canvas.getContext('2d')
    // ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)

    if (this.networkData.alphaVideo && this.networkData.alphaVideo.width === 0 && this.networkData.alphaVideo.videoWidth > 0)
    {
      this.networkData.alphaVideo.width = this.networkData.alphaVideo.videoWidth
      this.networkData.alphaVideo.height = this.networkData.alphaVideo.videoHeight
      this.networkData.alphaProcessor.setInputCanvas(this.networkData.alphaVideo)
      this.networkData.alphaProcessor.canvas.width = this.networkData.alphaVideo.width
      this.networkData.alphaProcessor.canvas.height = this.networkData.alphaVideo.height
    }

    try {
      ctx.drawImage(this.networkData.video, 0, 0, ctx.canvas.width, ctx.canvas.height)

      if (this.networkData.alphaVideo && this.networkData.alphaVideo.width)
      {
        this.networkData.alphaProcessor.setInputCanvas(this.networkData.alphaVideo)
        this.networkData.alphaProcessor.update()
        ctx.globalCompositeOperation = 'destination-in'
        ctx.drawImage(this.networkData.alphaProcessor.canvas, 0, 0, ctx.canvas.width, ctx.canvas.height)
        ctx.globalCompositeOperation = 'source-over'
      }
    } catch (e)
    {
      console.error(this.canvas.width, this.canvas.height, this.video, e)
    }
  }
  touch() {
    this.updateTime = document.querySelector('a-scene').time
  }
}

export class NetworkOutputNode extends CanvasNode {
  constructor(...opts) {
    super(...opts)

    this._name = this.id

    let alphaCanvas = document.createElement('canvas')
    alphaCanvas.width = 1024
    alphaCanvas.height = 512

    this.alphaProcessor = new CanvasShaderProcessor({fx: 'alpha-to-grayscale', canvas: alphaCanvas})
    this.alphaProcessor.setInputCanvas(this.canvas)
  }
  get name() {
    return this._name
  }
  set name(name) {
    console.log("Set name")
    if (name !== this._name)
    {
      if (this.peer)
      {
        this.peer.destroy()
      }
      this._name = name
      this.peer = this.compositor.el.sceneEl.systems['networking'].answerTo(this._name, this.canvas, this.alphaProcessor.canvas)
    }
  }
  get broadcasting() {
    return true
    // return this.peer
  }
  checkIfUpdateNeeded() { return true }
  updateCanvas(frame)
  {
    if (!this.destination) return

    if (!this.checkIfUpdateNeeded(frame)) return

    this.updateTime = document.querySelector('a-scene').time

    // No transparency in peerjs right now. grr
    let ctx = this.canvas.getContext('2d')

    this.destination.draw(ctx, frame, {mode: 'copy'})

    this.alphaProcessor.setInputCanvas(this.canvas)
    this.alphaProcessor.update()

    ctx.globalCompositeOperation = 'destination-over'
    ctx.fillStyle = "#fff"
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height)
    ctx.globalCompositeOperation = 'source-over'
  }
}
