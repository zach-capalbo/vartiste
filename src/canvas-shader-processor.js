let glBackingCanvas

const FX_UV_PASSTHROUGH = require('./shaders/fx-uv-passthrough.vert')

// Apply glsl shader effects directly to canvases
export class CanvasShaderProcessor {
  constructor({source, canvas, fx, vertexShader = FX_UV_PASSTHROUGH}) {
      if (fx) {
        source = require(`./shaders/fx/${fx}.glsl`)
      }

    this.source = source
    this.vertSource = vertexShader

    this.canvas = canvas
    if (!canvas)
    {
      if (!glBackingCanvas)
      {
        glBackingCanvas = document.createElement('canvas')
        glBackingCanvas.width = 2048
        glBackingCanvas.height = 2048
      }
      this.canvas = glBackingCanvas
    }

    this.textures = {}
    this.textureIdx = {}
  }
  getContext() {
    if (this._ctx) return this._ctx
    this._ctx = this.canvas.getContext("webgl") || this.canvas.getContext("experimental-webgl");
    return this._ctx
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
    if (this.program)
    {
      gl.useProgram(this.program);
      return this.program
    }
    let vertexShader = this.createShader(gl, gl.VERTEX_SHADER, this.vertSource)
    let fragmentShader = this.createShader(gl, gl.FRAGMENT_SHADER, this.source)

    let program = gl.createProgram()
    gl.attachShader(program, vertexShader)
    gl.attachShader(program, fragmentShader)
    gl.linkProgram(program)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS))
    {
      throw new Error(gl.getProgramInfoLog(program))
    }
    gl.useProgram(program);
    this.program = program

    this.initialUpdate();

    return this.program
  }
  setInputCanvas(canvas, {resize = true} = {}) {
    if (resize && (this.canvas.width !== canvas.width || this.canvas.height !== canvas.height))
    {
      this.canvas.width = canvas.width
      this.canvas.height = canvas.height
    }
    this.setupTexture(this.getContext(), "u_input", canvas)
    this.setUniform("u_width", "uniform1f", canvas.width)
    this.setUniform("u_height", "uniform1f", canvas.height)
  }
  setCanvasAttribute(name, canvas) {
    this.setupTexture(this.getContext(), name, canvas)
    this.setUniform(`${name}_width`, "uniform1f", canvas.width)
    this.setUniform(`${name}_height`, "uniform1f", canvas.height)
  }
  setUniform(name, type, value, ...vals){
    let gl = this.getContext()
    let program = this.getProgram(gl)
    let location = gl.getUniformLocation(program, name)
    if (location)
    {
      if (typeof value === 'function') { value = value() }
      gl[type](location, value, ...vals)
    }
  }
  setUniforms(type, vals) {
    for (let name in vals)
    {
      this.setUniform(name, type, vals[name])
    }
  }
  setupTexture(gl, name, textureCanvas) {
    let program = this.getProgram(gl)

    if (!this.textures[name])
    {
      console.log("Creating texture for", name)
      this.textures[name] = gl.createTexture()
      this.textureIdx[name] = Object.values(this.textures).length - 1
    }

    let texture = this.textures[name]
    let idx = this.textureIdx[name]

    if (!textureCanvas)
    {
      throw new Error("No canvas")
    }

    gl.activeTexture(gl.TEXTURE0 + idx);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, textureCanvas);
    // Set the parameters so we can render any size image.
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

   var location = gl.getUniformLocation(program, name);
   gl.uniform1i(location, idx);
  }
  updateTexture(gl, name, textureCanvas) {
    let program = this.getProgram(gl)
    let texture = this.textures[name]
    let idx = this.textureIdx[name]
    gl.activeTexture(gl.TEXTURE0 + idx);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, textureCanvas);
  }
  initialUpdate()
  {
    let gl = this.getContext()
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    gl.clearColor(0.0, 0.0, 0.0, 0.0);

    let program = this.getProgram(gl)

    let positionAttributeLocation = gl.getAttribLocation(program, "a_position");
    let positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    var positions = this.vertexPositions || [
      -1, -1,
      1, -1,
      1, 1,
      1, 1,
      -1, 1,
      -1, -1
    ];
    let typedArray = new Float32Array(positions)
    this.positionLength = positions.length
    gl.bufferData(gl.ARRAY_BUFFER, typedArray, gl.STATIC_DRAW);

    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

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

    this.hasDoneInitialUpdate = true
  }
  createVertexBuffer({name, list, size, type, normalize = false, stride = 0, offset = 0}) {
    let gl = this.getContext()
    let program = this.getProgram(gl)
    let attributeLocation = gl.getAttribLocation(program, name);

    type = type === undefined ? gl.FLOAT : type

    if (type !== gl.FLOAT)
    {
      throw new Error("TODO: Update to support other types")
    }

    let buffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(list), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(attributeLocation)
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.vertexAttribPointer(attributeLocation, size, type, normalize, stride, offset)
  }
  update(clear = true) {
    let canvas = this.canvas
    let gl = this.getContext()

    if (clear) gl.clear(gl.COLOR_BUFFER_BIT);

    let program = this.getProgram(gl)

    var primitiveType = gl.TRIANGLES;
    var offset = 0;
    var count = this.positionLength / 2;
    gl.drawArrays(primitiveType, offset, count);
  }
  drawBrush(brush, ctx, x, y, {rotation=0, pressure=1.0, distance=0.0, eraser=false, scale=1.0, reupdate=true} = {})
  {
    let {width, height, autoRotate} = brush
    width = Math.floor(width)
    height = Math.floor(height)


    if (reupdate)
    {
      this.setInputCanvas(ctx.canvas)
      console.log("Reupdate")
      this.initialUpdate()
      if (!('u_brush' in this.textures)) this.setCanvasAttribute("u_brush", brush.overlayCanvas)
    }
    else
    {
      this.updateTexture(this.getContext(), "u_input", ctx.canvas)
    }

    this.setUniform("u_color", "uniform3fv", brush.color3.toArray())
    this.setUniforms("uniform1f", {
      u_x: x,
      u_y: y,
      u_brush_width: brush.width * scale,
      u_brush_height: brush.height * scale,
      u_brush_rotation: autoRotate ? 2*Math.PI*Math.random() : rotation,
      u_opacity: brush.opacity * pressure,
      u_t: VARTISTE.Util.el.time % 1.0
    })

    this.update(false)

    ctx.globalAlpha = 1
    let oldOp = ctx.globalCompositeOperation
    ctx.globalCompositeOperation = 'copy'
    ctx.drawImage(this.canvas,
      0, 0, this.canvas.width, this.canvas.height,
      0, 0, ctx.canvas.width, ctx.canvas.height)
    ctx.globalCompositeOperation = oldOp
  }
  apply(inputCanvas, outputCanvas = undefined)
  {
    if (!outputCanvas) outputCanvas = inputCanvas
    this.setInputCanvas(inputCanvas)
    this.update()
    let ctx = outputCanvas.getContext('2d')
    ctx.clearRect(0, 0, outputCanvas.width, outputCanvas.height)
    ctx.globalCompositeOperation = 'source-over'
    ctx.drawImage(this.canvas,
                  0, 0, this.canvas.width, this.canvas.height,
                  0, 0, outputCanvas.width, outputCanvas.height)
    return outputCanvas
  }
}

const FORWARD = new THREE.Vector3(0, 0, 1)

let stretchBackingCanvas

export class UVStretcher extends CanvasShaderProcessor
{
  constructor(options) {
    if (!stretchBackingCanvas)
    {
      stretchBackingCanvas = document.createElement('canvas')
      stretchBackingCanvas.width = 2048
      stretchBackingCanvas.height = 2048
    }
    super(Object.assign({vertexShader: require('./shaders/stretch-brush-uv-passthrough.vert'), canvas: stretchBackingCanvas}, options))
    this.vertexPositions = []
    this.uvs = []
    this.opacities = []

    this.point1 = new THREE.Vector3
    this.point2 = new THREE.Vector3
    this.point3 = new THREE.Vector3
    this.direction = new THREE.Vector3
    this.direction2 = new THREE.Vector3

  }
  reset() {
    this.vertexPositions.length = 0
    this.uvs.length = 0
    this.opacities.length = 0
    this.accumDistance = 0
  }
  updatePoints(points) {
    if (points.length === 0)
    {
      return
    }

    this.createMesh(points)
  }
  createMesh(points, {maxDistance = 0.3} = {}) {
    let {point1, point2, point3, direction, direction2} = this
    this.vertexPositions.length = 0
    this.uvs.length = 0
    this.opacities.length = 0
    let distance = 0
    let segDistance = 0
    let accumDistance = 0
    let discontinuity = false
    for (let i = 0; i < points.length - 1; ++i)
    {
      point1.set(points[i].x, points[i].y, 0)
      point2.set(points[i + 1].x, points[i + 1].y, 0)
      point2.sub(point1)
      distance += point2.length()
    }

    for (let i = 0; i < points.length - 1; ++i)
    {
      point1.set(points[i].x, points[i].y, 0)
      point2.set(points[i + 1].x, points[i + 1].y, 0)

      direction.subVectors(point2, point1)
      segDistance = direction.length()

      const directionScalar = 0.03

      if (segDistance > maxDistance)
      {
        discontinuity = true;
        continue
      }

      if (i === 0 || discontinuity)
      {
        direction.normalize()
        direction.cross(FORWARD)
        direction.multiplyScalar(points[i].scale * directionScalar)
      }
      else
      {
        direction.copy(direction2)
      }

      if (i < points.length - 2)
      {
        point3.set(points[i + 2].x, points[i + 2].y, 0)
        direction2.subVectors(point3, point2)
        direction2.normalize()
        direction2.cross(FORWARD)
        direction2.multiplyScalar(points[i+1].scale * directionScalar)
        direction2.lerp(direction, 0.5)
      }
      else
      {
        direction2.copy(direction)
      }

      discontinuity = false

      let uvStart = accumDistance
      accumDistance += segDistance / distance
      let uvEnd = accumDistance

      // Tri 1
      this.vertexPositions.push(point1.x + direction.x, point1.y + direction.y)
      this.vertexPositions.push(point2.x - direction2.x, point2.y - direction2.y)
      this.vertexPositions.push(point1.x - direction.x, point1.y - direction.y)

      this.uvs.push(uvStart, 0,
                    uvEnd, 1,
                    uvStart, 1)

      this.opacities.push(
        points[i].opacity,
        points[i+1].opacity,
        points[i].opacity,
      )


      // Tri 2
      this.vertexPositions.push(point2.x - direction2.x, point2.y - direction2.y)
      this.vertexPositions.push(point1.x + direction.x, point1.y + direction.y)
      this.vertexPositions.push(point2.x + direction2.x, point2.y + direction2.y)

      this.uvs.push(uvEnd, 1,
                    uvStart, 0,
                    uvEnd, 0)

      this.opacities.push(
        points[i + 1].opacity,
        points[i].opacity,
        points[i + 1].opacity,)
    }

    this.startPoint = null
    this.endPoint = null
    this.hasDoneInitialUpdate = false
  }
  initialUpdate() {
    super.initialUpdate()
    this.createVertexBuffer({name: "a_uv", list: this.uvs, size: 2})
    this.createVertexBuffer({name: "a_opacity", list: this.opacities, size: 1})

    let gl = this.getContext()
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_COLOR, gl.ONE_MINUS_SRC_ALPHA);
  }
}

window.CanvasShaderProcessor = CanvasShaderProcessor
