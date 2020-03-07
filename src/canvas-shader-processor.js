let glBackingCanvas

export class CanvasShaderProcessor {
  constructor({source, canvas}) {
    this.source = source

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
    return this.canvas.getContext("webgl") || this.canvas.getContext("experimental-webgl");
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
      return this.program
    }
    let vertexShader = this.createShader(gl, gl.VERTEX_SHADER, require('./shaders/fx-uv-passthrough.vert'))
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
    return this.program
  }
  setInputCanvas(canvas) {
    this.setupTexture(this.getContext(), "u_input", canvas)
    this.setUniform("u_width", "uniform1f", canvas.width)
    this.setUniform("u_height", "uniform1f", canvas.height)
  }
  setCanvasAttribute(name, canvas) {
    this.setupTexture(this.getContext(), name, canvas)
    this.setUniform(`${name}_width`, "uniform1f", canvas.width)
    this.setUniform(`${name}_height`, "uniform1f", canvas.height)
  }
  setUniform(name, type, value){
    let gl = this.getContext()
    let program = this.getProgram(gl)
    let location = gl.getUniformLocation(program, name)
    if (location)
    {
      if (typeof value === 'function') { value = value() }
      gl[type](location, value)
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
  update() {
    let canvas = this.canvas
    let gl = this.getContext()
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
