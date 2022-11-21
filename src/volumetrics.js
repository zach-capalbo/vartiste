import {Util} from './util.js'
import {Pool} from './pool.js'
import {Undo} from './undo.js'
Util.registerComponentSystem('volumetrics', {
  schema: {
    onion: {default: false},
    bumpy: {default: false},
    hard: {default: true},
    noisy: {default: false},
    bristles: {default: false},
    undoEnabled: {default: false},
    undoThrottle: {default: 250},
    autoDilate: {default: true},
  },
  init() {
    this.lastUndoCheck = 0
  },
  activate() {
    if (this.proc) return;

    let canvas = document.createElement('canvas')
    canvas.width = Compositor.component.width * 2
    canvas.height = Compositor.component.height * 2
    let proc = new CanvasShaderProcessor({source: require('./shaders/shapes/volumetrics.v3.glsl'), vertexShader: require('./shaders/vertex-distance.vert'), canvas})
    this.proc = proc
    this.initializeGeometry()

    this.dilateProc  = new CanvasShaderProcessor({fx: 'dilate', canvas: Util.createCanvas(canvas.width, canvas.height)})

    this.active = function() {};
    this.tick = AFRAME.utils.throttleTick(this._tick, 10, this)

    let intersectionCanvas = document.createElement('canvas')
    intersectionCanvas.width = canvas.width
    intersectionCanvas.height = 1
    this.intersectionCanvas = intersectionCanvas

    let shaderSrc = require('./shaders/calc-max.glsl').replace('#define HEIGHT 1.0', `#define HEIGHT ${canvas.height}.0`)
    let intersectionProc = new CanvasShaderProcessor({source: shaderSrc})
    this.intersectionProc = intersectionProc

    let preUndoCanvas = document.createElement('canvas')
    preUndoCanvas.width = Compositor.component.width
    preUndoCanvas.height = Compositor.component.height
  },
  initializeGeometry() {
    let proc = this.proc

    let totalUVLength = 0
    let totalVertexLength = 0
    let allUvArrays = []
    let vertexPositions = []
    for (let mesh of Compositor.meshes)
    {
      let geometry = mesh.geometry.toNonIndexed()
      if (!geometry.attributes.uv) continue
      allUvArrays.push(geometry.attributes.uv.array)
      totalUVLength += geometry.attributes.uv.array.length
      vertexPositions.push(geometry.attributes.position.array)
      totalVertexLength += geometry.attributes.position.array.length
    }

    proc.vertexPositions = new Float32Array(totalUVLength)
    let arrayIdx = 0;
    for (let array of allUvArrays)
    {
      proc.vertexPositions.set(array, arrayIdx)
      arrayIdx += array.length
    }

    proc.hasDoneInitialUpdate = false

    let vertexFloats = new Float32Array(totalVertexLength)
    arrayIdx = 0;
    for (let array of vertexPositions)
    {
      vertexFloats.set(array, arrayIdx)
      arrayIdx += array.length
    }
    proc.createVertexBuffer({name: "a_vertexPosition", list: vertexFloats, size: 3})

    proc.initialUpdate()

    let gl = proc.getContext()
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_COLOR, gl.ONE_MINUS_SRC_ALPHA);

    this.seenGeometry = Compositor.mesh.geometry
  },
  checkIntersection() {
    if (!this.data.undoEnabled) return false

    let {proc, intersectionCanvas, intersectionProc} = this

    intersectionProc.setInputCanvas(proc.canvas)
    intersectionProc.update()

    let gl = intersectionProc.getContext()

    var pixels = this.intersectionPixels || new Uint8Array(intersectionCanvas.width * intersectionCanvas.height * 4);
    // gl.readPixels(0, 0, intersectionCanvas.width, intersectionCanvas.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    //
    // let intersected = false
    // for (let i = 0; i < intersectionCanvas.width; ++i)
    // {
    //   if (pixels[i * 4] > 0) return true
    // }

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
        if (e.detail === 'grabbed' || e.detail === 'grabbed')
        {
          this.wasDrawing = false
        }
      },
      click: function() {
        if (this.el.is('grabbed') || this.el.is('wielded'))
        {
          this.el.setAttribute(`volume-${name}-tool`, 'toolActive', !this.data.toolActive)
        }
      }
    },
    init() {
      Pool.init(this)
      this.volumetrics = this.el.sceneEl.systems.volumetrics

      this.el.classList.add('grab-root')
      this.el.classList.add('volume-tool')
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

      this.initialScale = this.el.object3D.scale.x
    },
    tick(t,dt) {
      if (!(this.el.is('grabbed') || this.el.is('wielded'))) return
      if (!this.volumetrics.proc) return
      if (!this.data.toolActive) return

      // console.log("Drawing volume")

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

      proc.setUniform('u_userScale', 'uniform1f', Math.max(1.0, this.el.object3D.scale.x / this.initialScale))

      let target = Compositor.mesh
      let destMat = this.pool('dest', THREE.Matrix4)
      destMat.copy(this.tip.object3D.matrixWorld)
      let invMat = this.pool('inv', THREE.Matrix4)
      invMat.copy(target.matrixWorld).invert()
      destMat.premultiply(invMat)
      invMat.identity()
      invMat.extractRotation(destMat)
      invMat.copy(invMat).invert()

      proc.setUniform('u_matrix', 'uniformMatrix4fv', false, invMat.elements)

      proc.setUniform('u_color', 'uniform4f', this.system.color3.r, this.system.color3.g, this.system.color3.b, this.system.brush.opacity)

      proc.setUniform('u_shape', 'uniform1i', toolOpts.shape)

      proc.setUniform('u_rand', 'uniform3f', Math.random(), Math.random(), Math.random())

      proc.setUniform('u_onion', 'uniform1i', this.volumetrics.data.onion)
      proc.setUniform('u_bumpy', 'uniform1i', this.volumetrics.data.bumpy)
      proc.setUniform('u_hard', 'uniform1i', this.volumetrics.data.hard)
      proc.setUniform('u_noisy', 'uniform1i', this.volumetrics.data.noisy)
      proc.setUniform('u_bristles', 'uniform1i', this.volumetrics.data.bristles)

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

      let procCanvas = proc.canvas

      if (this.volumetrics.data.autoDilate)
      {
        this.volumetrics.dilateProc.setInputCanvas(proc.canvas)
        this.volumetrics.dilateProc.update()
        procCanvas = this.volumetrics.dilateProc.canvas
      }

      let ctx = destinationCanvas.getContext("2d")
      // ctx.globalCompositeOperation = 'copy'
      ctx.globalAlpha = 1.0
      ctx.drawImage(procCanvas,
                    0, 0, procCanvas.width, procCanvas.height,
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

    // let tip = document.createElement('a-entity')
    // tip.setAttribute('sdf-brush-render-box', `boxSize: ${this.data.baseSize * 3} ${this.data.baseSize * 3} ${this.data.baseSize * 3}; u_size: 0.04`)

    // tip.setAttribute('geometry', `width: ; height: ${this.data.baseSize * 3}; depth: ${this.data.baseSize * 3}`)
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

AFRAME.registerComponent('instance-splat', {
  init() {
    let numPoints = 75
    let delta = 1.0 / numPoints;
    let sourceGeometry = new THREE.BoxGeometry(delta,delta,delta)
    // let sourceGeometry = new THREE.PlaneGeometry(delta)//,delta,delta)
    let material = new THREE.RawShaderMaterial({
      fragmentShader: require('./shaders/shapes/instance-splat.glsl'),
      vertexShader: require('./shaders/instance-pass-through.vert'),
      // transparent: true,
      // side: THREE.BackSide,
      // side: THREE.DoubleSide,
      // instancing: true
    })
    // material.instancing = true
    let instancedMesh = new THREE.InstancedMesh(sourceGeometry, material, numPoints*numPoints*numPoints)
    this.el.object3D.add(instancedMesh)
    // this.el.setObject3D('mesh', instancedMesh)

    let tmpMat = new THREE.Matrix4
    let i = 0;
    for (let x = 0; x < numPoints; ++x)
    {
      for (let y = 0; y < numPoints; ++y)
      {
        for (let z = 0; z < numPoints; ++z)
        {
          tmpMat.identity()
          tmpMat.makeTranslation(delta * x, delta * y, delta * z)
          instancedMesh.setMatrixAt(i++, tmpMat)
        }
      }
    }
    instancedMesh.instanceMatrix.needsUpdate = true
    window.instancedMesh = instancedMesh
  }
})

AFRAME.registerComponent('sdf-brush-render-box', {
  schema: {
    boxSize: {type: 'vec3', default: {x: 1, y: 1, z: 1}},
    u_size: {default: 0.3}
  },
  init() {
    let texture = new THREE.Texture;
    texture.image = this.el.sceneEl.querySelector('#asset-matcap')
    texture.image.decode().then(() => texture.needsUpdate = true)
    let sourceGeometry = new THREE.BoxGeometry(this.data.boxSize.x, this.data.boxSize.y, this.data.boxSize.z)
    let material = new THREE.RawShaderMaterial( {
          glslVersion: THREE.GLSL3,
					uniforms: {
						matcap: { value: texture },
						cameraPos: { value: new THREE.Vector3() },
						threshold: { value: 0.0 },
						steps: { value: 2000 },

            u_rand: {value: Math.random()},
            u_onion: {value: false},
            u_bumpy: {value: false},
            u_bristles: {value: false},
            u_size: {value: this.data.u_size},
					},
          fragmentShader: require('./shaders/shapes/brush-display.v3.glsl'),
          vertexShader: require('!!raw-loader!./shaders/raymarch.vert').default,
					side: THREE.BackSide,
          // transparent: true,
				} );
    this.mesh = new THREE.Mesh(sourceGeometry, material)
    this.el.object3D.add(this.mesh)
    window.sdfMesh = this.mesh
  },
  update(oldData) {
    let uniforms = this.mesh.material.uniforms;
    uniforms.u_size.value = this.data.u_size;
  },
  tick(t, dt) {
    let uniforms = this.mesh.material.uniforms;
    let volumetrics = this.el.sceneEl.systems.volumetrics
    Util.cameraObject3D().getWorldPosition(uniforms.cameraPos.value);
    uniforms.u_onion.value = volumetrics.data.onion
    uniforms.u_bumpy.value = volumetrics.data.bumpy
    uniforms.u_bristles.value = volumetrics.data.bristles

    // this.mesh.material.uniforms.u_rand.value = Math.random()
  }
})

AFRAME.registerComponent('sdf-scene', {
  schema: {
    boxSize: {type: 'vec3', default: {x: 1, y: 1, z: 1}},
    u_size: {default: 0.3}
  },
  init() {
    let texture = new THREE.Texture;
    texture.image = this.el.sceneEl.querySelector('#asset-matcap')
    texture.image.decode().then(() => texture.needsUpdate = true)
    let sourceGeometry = new THREE.BoxGeometry(this.data.boxSize.x, this.data.boxSize.y, this.data.boxSize.z)

    const numShapes = 50
    this.shapeUniforms = []
    for (let i = 0; i < numShapes; ++i)
    {
      this.shapeUniforms[i] = {
        matrix: new THREE.Matrix4().makeTranslation(0.2, 0, 0).multiply(new THREE.Matrix4().makeScale(0.5, 0.5, 0.5)),
        color: new THREE.Color("red"),
        shape: 1,
        op: 5,
        size: new THREE.Vector4(0.3, 0.3, 0.3, 0.05),
        last: 1,
      };
    }

    let material = new THREE.RawShaderMaterial( {
          glslVersion: THREE.GLSL3,
					uniforms: {
						matcap: { value: texture },
						cameraPos: { value: new THREE.Vector3() },
						threshold: { value: 0.0 },
						steps: { value: 2000 },

            u_rand: {value: Math.random()},
            u_onion: {value: false},
            u_bumpy: {value: false},
            u_bristles: {value: false},
            u_size: {value: this.data.u_size},

            u_scene: {value: this.shapeUniforms},
					},
          fragmentShader: require('./shaders/shapes/sdf-scene.v3.glsl'),
          vertexShader: require('!!raw-loader!./shaders/raymarch.vert').default,
					side: THREE.BackSide,
          // transparent: true,
				} );
    this.mesh = new THREE.Mesh(sourceGeometry, material)
    this.el.object3D.add(this.mesh)
    window.sdfMesh = this.mesh
  },
  update(oldData) {
    let uniforms = this.mesh.material.uniforms;
    uniforms.u_size.value = this.data.u_size;
  },
  tick(t, dt) {
    let uniforms = this.mesh.material.uniforms;
    let volumetrics = this.el.sceneEl.systems.volumetrics
    Util.cameraObject3D().getWorldPosition(uniforms.cameraPos.value);
    uniforms.u_onion.value = volumetrics.data.onion
    uniforms.u_bumpy.value = volumetrics.data.bumpy
    uniforms.u_bristles.value = volumetrics.data.bristles

    // this.mesh.material.uniforms.u_rand.value = Math.random()
  }
})

AFRAME.registerComponent('sdf-join-op', {
  schema: {
    type: {oneOf: ['union', 'subtraction', 'intersection', 'smoothUnion', 'smoothSubtraction', 'smoothIntersection']}
  }
})

AFRAME.registerComponent('sdf-shape', {
  schema: {
    shape: {oneOf: ['sphere', 'boundingBox', 'box', 'cone']},
    op: {oneOf: ['union', 'subtraction', 'intersection', 'smoothUnion', 'smoothSubtraction', 'smoothIntersection']},
  },
})
