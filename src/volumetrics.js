import {Util} from './util.js'
import {Pool} from './pool.js'
import {Undo} from './undo.js'
Util.registerComponentSystem('volumetrics', {
  schema: {
    onion: {default: false},
    bumpy: {default: false},
    hard: {default: true},
  },
  init() {

  },
  activate() {
    if (this.proc) return;

    let canvas = document.createElement('canvas')
    canvas.width = Compositor.component.width * 2
    canvas.height = Compositor.component.height * 2
    let proc = new CanvasShaderProcessor({source: require('./shaders/shapes/volumetrics.glsl'), vertexShader: require('./shaders/vertex-distance.vert'), canvas})
    this.proc = proc
    this.initializeGeometry()

    this.active = function() {};
    this.tick = AFRAME.utils.throttleTick(this._tick, 10, this)

    let intersectionCanvas = document.createElement('canvas')
    intersectionCanvas.width = canvas.width
    intersectionCanvas.height = 1
    this.intersectionCanvas = intersectionCanvas

    let shaderSrc = require('./shaders/calc-max.glsl').replace('#define HEIGHT 1.0', `#define HEIGHT ${canvas.height}.0`)
    let intersectionProc = new CanvasShaderProcessor({source: shaderSrc})
    this.intersectionProc = intersectionProc
  },
  initializeGeometry() {
    let geometry = Compositor.mesh.geometry.toNonIndexed()
    let proc = this.proc
    proc.vertexPositions = geometry.attributes.uv.array
    proc.hasDoneInitialUpdate = false
    proc.createVertexBuffer({name: "a_vertexPosition", list: geometry.attributes.position.array, size: geometry.attributes.position.itemSize})

    let vertexIndex = []
    vertexIndex.length = geometry.attributes.position.count
    for (let i = 0; i < geometry.attributes.position.count; i++)
    {
      vertexIndex[i] = i;
    }
    // proc.createVertexBuffer({name: "a_vertexIndex", list: vertexIndex, size: 1})

    proc.initialUpdate()

    let gl = proc.getContext()
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_COLOR, gl.ONE_MINUS_SRC_ALPHA);

    this.seenGeometry = Compositor.mesh.geometry
  },
  checkIntersection() {
    let {proc, intersectionCanvas, intersectionProc} = this

    intersectionProc.setInputCanvas(proc.canvas)
    intersectionProc.update()

    let gl = intersectionProc.getContext()

    var pixels = this.intersectionPixels || new Uint8Array(intersectionCanvas.width * intersectionCanvas.height * 4);
    gl.readPixels(0, 0, intersectionCanvas.width, intersectionCanvas.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

    let intersected = false
    for (let i = 0; i < intersectionCanvas.width; ++i)
    {
      if (pixels[i * 4] > 0) return true
    }

    return false
  },
  tick(t,dt) {},
  _tick(t, dt) {
    if (this.seenGeometry !== Compositor.mesh.geometry) this.initializeGeometry()
  }
})


function registerVolumeTool(name, toolOpts) {
  AFRAME.registerComponent(`volume-${name}-tool`, {
    dependencies: ['six-dof-tool', 'grab-activate'],
    schema: {
      baseSize: {default: 0.07},
      toolActive: {default: true},
    },
    events: {
      activate: function() { this.activate(); },
      stateremoved: function(e) {
        if (e.detail === 'grabbed')
        {
          this.wasDrawing = false
        }
      },
      click: function() {
        if (this.el.is('grabbed'))
        {
          this.el.setAttribute(`volume-${name}-tool`, 'toolActive', !this.data.toolActive)
        }
      }
    },
    init() {
      Pool.init(this)
      this.volumetrics = this.el.sceneEl.systems.volumetrics

      this.el.classList.add('grab-root')
      this.el.setAttribute('grab-options', 'showHand: false')
      let body = document.createElement('a-cylinder')
      body.setAttribute('height', 0.3)
      body.setAttribute('radius', 0.07)
      body.setAttribute('segments-radial', 6)
      body.setAttribute('segments-height', 3)
      body.setAttribute('material', 'side: double; src: #asset-shelf; metalness: 0.4; roughness: 0.7')
      body.setAttribute('grab-options', 'showHand: false')
      body.classList.add('clickable')
      body.setAttribute('propogate-grab', "")
      this.body = body
      this.el.append(body)

      let tip = toolOpts.createTip.call(this)
      tip.setAttribute('position', '0 0.25 0')
      tip.setAttribute('material', 'side: double; color: red; wireframe: true')
      tip.classList.add('clickable')
      // tip.setAttribute('propogate-grab', '')
      tip.setAttribute("show-current-color", "")
      this.tip = tip
      this.el.append(tip)

      this.tick = AFRAME.utils.throttleTick(this.tick, 10, this)

      this.system = this.el.sceneEl.systems['paint-system']

      if (this.el.hasAttribute('preactivate-tooltip') && !this.el.hasAttribute('tooltip-style'))
      {
        this.el.setAttribute('tooltip-style', "scale: 0.3 0.3 1.0; offset: 0 0 0")
      }
    },
    update(oldData) {
      if (this.data.toolActive !== oldData.toolActive)
      {
        this.body.setAttribute('material', 'shader', this.data.toolActive ? "standard" : "flat")
        this.body.setAttribute('material', 'color', this.data.toolActive ? "#fff" : "#9ff")

        if (!this.data.toolActive) this.wasDrawing = false
      }
    },
    activate() {
      this.volumetrics.activate()
    },
    tick(t,dt) {
      if (!this.el.is('grabbed')) return
      if (!this.volumetrics.proc) return
      if (!this.data.toolActive) return

      console.log("Drawing volume")

      let proc = this.volumetrics.proc
      let destinationCanvas = Compositor.drawableCanvas
      if (this.lastCanvas !== destinationCanvas)
      {
        proc.setInputCanvas(destinationCanvas, {resize: false})
      }
      this.lastCanvas = destinationCanvas

      let tipPos = this.pool("tipPos", THREE.Vector3)
      let tipRad = this.pool("tipRad", THREE.Vector3)

      tipRad.set(this.data.baseSize, 0,0)

      this.tip.object3D.getWorldPosition(tipPos)
      Compositor.mesh.worldToLocal(tipPos)

      this.tip.object3D.localToWorld(tipRad)
      Compositor.mesh.worldToLocal(tipRad)

      proc.setUniform('u_center', 'uniform3f', tipPos.x, tipPos.y, tipPos.z)

      tipRad.sub(tipPos)

      proc.setUniform('u_size', 'uniform1f', tipRad.length())

      let target = Compositor.mesh
      let destMat = this.pool('dest', THREE.Matrix4)
      destMat.copy(this.tip.object3D.matrixWorld)
      let invMat = this.pool('inv', THREE.Matrix4)
      invMat.getInverse(target.matrixWorld)
      destMat.premultiply(invMat)
      invMat.identity()
      invMat.extractRotation(destMat)
      invMat.getInverse(invMat)

      proc.setUniform('u_matrix', 'uniformMatrix4fv', false, invMat.elements)

      proc.setUniform('u_color', 'uniform4f', this.system.brush.color3.r, this.system.brush.color3.g, this.system.brush.color3.b, this.system.brush.opacity)

      proc.setUniform('u_shape', 'uniform1i', toolOpts.shape)

      proc.setUniform('u_rand', 'uniform3f', Math.random(), Math.random(), Math.random())

      proc.setUniform('u_onion', 'uniform1i', this.volumetrics.data.onion)
      proc.setUniform('u_bumpy', 'uniform1i', this.volumetrics.data.bumpy)
      proc.setUniform('u_hard', 'uniform1i', this.volumetrics.data.hard)

      // proc.setInputCanvas(Compositor.drawableCanvas)

      proc.update()

      let intersecting = this.volumetrics.checkIntersection()

      if (intersecting && !this.wasDrawing)
      {
        Undo.pushCanvas(destinationCanvas)
        this.wasDrawing = true
      }
      else if (!intersecting)
      {
        this.wasDrawing = false
      }

      let ctx = destinationCanvas.getContext("2d")
      // ctx.globalCompositeOperation = 'copy'
      ctx.globalAlpha = 1.0
      ctx.drawImage(proc.canvas,
                    0, 0, proc.canvas.width, proc.canvas.height,
                    0, 0, destinationCanvas.width, destinationCanvas.height)

      if (destinationCanvas.touch) destinationCanvas.touch()
    }
  })
}

registerVolumeTool('sphere', {
  createTip() {
    let tip = document.createElement('a-sphere')
    tip.setAttribute('radius', this.data.baseSize)
    tip.setAttribute('segments-radial', 6)
    tip.setAttribute('segments-height', 4)
    return tip
  },
  shape: 0,
})

registerVolumeTool('cube', {
  createTip() {
    let tip = document.createElement('a-box')
    tip.setAttribute('width', this.data.baseSize * 2.0)
    tip.setAttribute('height', this.data.baseSize * 2.0)
    tip.setAttribute('depth', this.data.baseSize * 2.0)
    return tip
  },
  shape: 2
})

registerVolumeTool('cone', {
  createTip() {
    let tip = document.createElement('a-cone')
    tip.setAttribute('height', this.data.baseSize * 3)
    tip.setAttribute('radius-top', 0)
    tip.setAttribute('radius-bottom', this.data.baseSize)
    // tip.setAttribute('radius-bottom', this.data.baseSize * 0.1)
    return tip
  },
  shape: 3,
})

registerVolumeTool('brush', {
  createTip() {
    let tip = document.createElement('a-entity')
    tip.setAttribute('gltf-model', '#asset-volume-brush')
    tip.setAttribute('apply-material-to-mesh', '')
    return tip
  },
  shape: 4,
})
