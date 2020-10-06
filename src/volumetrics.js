import {Util} from './util.js'
import {Pool} from './pool.js'
Util.registerComponentSystem('volumetrics', {
  init() {

  },
  activate() {
    let canvas = document.createElement('canvas')
    canvas.width = Compositor.component.width
    canvas.height = Compositor.component.height
    let proc = new CanvasShaderProcessor({source: require('./shaders/shapes/sphere.glsl'), vertexShader: require('./shaders/vertex-distance.vert'), canvas})
    this.proc = proc
    this.initializeGeometry()

    this.active = function() {};
    this.tick = AFRAME.utils.throttleTick(this._tick, 10, this)
  },
  initializeGeometry() {
    let geometry = Compositor.mesh.geometry.toNonIndexed()
    let proc = this.proc
    proc.vertexPositions = geometry.attributes.uv.array
    proc.hasDoneInitialUpdate = false
    proc.createVertexBuffer({name: "a_vertexPosition", list: geometry.attributes.position.array, size: geometry.attributes.position.itemSize})
    proc.initialUpdate()

    this.seenGeometry = Compositor.mesh.geometry
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
      baseSize: {default: 0.07}
    },
    events: {
      activate: function() { this.activate(); }
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
    },
    activate() {
      this.volumetrics.activate()
    },
    tick(t,dt) {
      if (!this.el.is('grabbed')) return
      if (!this.volumetrics.proc) return

      let proc = this.volumetrics.proc
      let destinationCanvas = Compositor.drawableCanvas
      if (this.lastCanvas !== destinationCanvas)
      {
        proc.setInputCanvas(destinationCanvas)
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

      // proc.setInputCanvas(Compositor.drawableCanvas)

      proc.update()

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
