import shortid from 'shortid'
import {THREED_MODES} from "./layer-modes.js"
import {Util} from "./util.js"
import {Pool} from "./pool.js"

AFRAME.registerComponent('skeletonator', {
  schema: {
    recording: {default: true},
    frameCount: {default: 50},
    recordFrameCount: {default: false},
  },
  init() {
    window.Skeletonator = this
    this.mesh = this.el.getObject3D('mesh').getObjectByProperty("type", "SkinnedMesh")

    if (!this.mesh)
    {
      console.log("Converting first mesh to skinned mesh")
      let firstMesh = this.el.getObject3D('mesh').getObjectByProperty("type", "Mesh")

      var position = firstMesh.geometry.attributes.position;

      var skinIndices = [];
      var skinWeights = [];

      for ( var i = 0; i < position.count; i ++ ) {

      	var skinIndex = 0;
      	var skinWeight = 1.0;

      	skinIndices.push( skinIndex, 0, 0, 0 );
      	skinWeights.push( skinWeight, 0, 0, 0 );

      }

      firstMesh.geometry.setAttribute( 'skinIndex', new THREE.Uint16BufferAttribute( skinIndices, 4 ) );
      firstMesh.geometry.setAttribute( 'skinWeight', new THREE.Float32BufferAttribute( skinWeights, 4 ) );

      let skinnedMesh = new THREE.SkinnedMesh(firstMesh.geometry, firstMesh.material)
      // Util.applyMatrix(firstMesh.matrix, skinnedMesh)

      let rootBone = new THREE.Bone()
      skinnedMesh.add(rootBone)

      skinnedMesh.bind(new THREE.Skeleton([rootBone]), new THREE.Matrix4())

      firstMesh.parent.add(skinnedMesh)
      firstMesh.parent.remove(firstMesh)
      this.mesh = skinnedMesh
    }

    this.el.classList.remove('canvas')
    this.el.classList.remove('clickable')

    let controlPanel = document.createElement('a-entity')
    controlPanel.innerHTML = require('./partials/skeletonator-control-panel.html.slm')
    controlPanel.setAttribute('position', "-1.5 0 0.4")
    controlPanel.skeletonator = this
    controlPanel.setAttribute('skeletonator-control-panel', "")

    document.querySelector('#left-shelf').append(controlPanel)
    this.controlPanel = controlPanel

    this.setupBones()

    Compositor.el.addEventListener('framechanged', this.onFrameChange.bind(this))

    if (Compositor.el.skeletonatorSavedSettings)
    {
      this.load(Compositor.el.skeletonatorSavedSettings)
    }

    Compositor.el.setAttribute('compositor', {skipDrawing: true})
    document.querySelectorAll('*[layer-shelves]').forEach(el => el.setAttribute('visible', false))
  },
  tick(t, dt) {
    if (!this.mesh.material.skinning)
    {
      let oldMaterial = this.mesh.material
      this.mesh.material = new THREE.MeshStandardMaterial({
        skinning: true,
        transparent: true,
        opacity: 0.5
      })

      for (let mode of ["map"].concat(THREED_MODES))
      {
        if (oldMaterial[mode])
        {
          this.mesh.material[mode] = oldMaterial[mode]
        }
      }
    }
  },
  load(obj) {
    console.log("Loading saved skeletonator")
    this.el.setAttribute('skeletonator', {frameCount: obj.frameCount})
    if ('boneTracks' in obj) {
      for (let bone in this.boneTracks)
      {
        this.boneTracks[bone] = obj.boneTracks[bone].filter(m => m).map(m => new THREE.Matrix4().fromArray(m.elements))
      }
    }
  },
  setupBones() {
    this.boneToHandle = {}
    this.boneTracks = {}

    for (let bone of this.mesh.skeleton.bones)
    {
      if (bone.name in this.boneToHandle) continue;

      this.el.append(this.addBoneHierarchy(bone))
    }
  },
  addBoneHierarchy(bone)
  {
    console.log("Adding bone", bone)
    let handle = document.createElement('a-entity')
    handle.setAttribute('bone-handle', "")
    handle.classList.add("clickable")
    handle.bone = bone
    handle.skeletonator = this
    this.boneToHandle[bone.name] = handle
    this.boneTracks[bone.name] = []

    handle.addEventListener('click', e => {
      this.setActiveBone(bone)
      e.stopPropagation()
    })

    for (let child of bone.children)
    {
      handle.append(this.addBoneHierarchy(child))
    }

    return handle
  },
  updateHandles() {
    this.el.querySelectorAll('*[bone-handle]').forEach(handle => handle.components['bone-handle'].resetToBone())
  },
  renameBone(bone, newName) {
    console.log("Renaming bone", bone, newName)
    if (newName in this.boneToHandle)
    {
      throw new Error(`Name ${newName} already taken`)
    }

    this.boneToHandle[newName] = this.boneToHandle[bone.name]
    this.boneTracks[newName] = this.boneTracks[bone.name]
    delete this.boneToHandle[bone.name]
    delete this.boneTracks[bone.name]
    bone.name = newName
  },
  deleteBone(bone) {
    delete this.boneToHandle[bone.name]
    delete this.boneTracks[bone.name]
    bone.parent.remove(bone)
    this.boneToHandle[bone.name].parentEl.removeChild(this.boneToHandle[bone.name])
    delete this.boneToHandle[bone.name]
    delete this.boneTracks[bone.name]
  },
  setActiveBone(bone) {
    console.log("Setting active bone to", bone)
    if (this.activeBone) {
      this.boneToHandle[this.activeBone.name].setAttribute('material', {color: '#c9f0f2'})
    }

    this.activeBone = bone
    if (this.activeBone)
    {
      this.boneToHandle[this.activeBone.name].setAttribute('material', {color: '#f5363f'})
    }
    this.el.emit('activebonechanged', {activeBone: this.activeBone})
  },
  skinFromeNodes() {
    let vertexUvs = this.mesh.geometry.attributes.uv
    let uv = new THREE.Vector2()

    var skinIndices = [];
    var skinWeights = [];

    let canvasByName = {}

    for (let node of Compositor.component.allNodes)
    {
      if (node.name) {
        if (!node.inputs.canvas) continue
        if (!node.inputs.canvas.canvas) {
          console.warn("No canvas for", node)
          continue
        }

        canvasByName[node.name] = node.inputs.canvas.canvas
      }
    }

    console.log("Canvas by name", canvasByName)

    for (let vi = 0; vi < vertexUvs.count; vi ++ )
    {
      uv.fromBufferAttribute(vertexUvs, vi)

      let topFour = [
        {idx: 0, weight: 0},
        {idx: 0, weight: 0},
        {idx: 0, weight: 0},
        {idx: 0, weight: 0},
      ]

      let anySet = false;

      let bones = this.mesh.skeleton.bones

      for (let i in bones)
      {
        let bone = bones[i]
        if (!(bone.name in canvasByName)) {
        //   console.log("No canvas for", bone.name)
          continue
        }
        let canvas = canvasByName[bone.name]
        let color = canvas.getContext('2d').getImageData(Math.round(uv.x * canvas.width), Math.round(uv.y * canvas.height), 1, 1)
        let alpha = color.data[3] / 255.0
        // console.log("Sampled", JSON.stringify(color.s), bone.name)
        if (alpha > topFour[3].weight)
        {
          topFour[3].idx = i
          topFour[3].weight = alpha
          topFour.sort((a,b) => - (a.weight - b.weight))
          anySet = true
          console.log("Alpha > 0", alpha, JSON.stringify(topFour))
        }
      }

      if (topFour.weight > 0)
      {
        console.log("Pushing", vi, topFour)
      }

      if (!anySet)
      {
        topFour[0].weight = 1
      }

      let norm = topFour[0].weight + topFour[1].weight + topFour[2].weight + topFour[3].weight

      if (norm < 1.0)
      {
        topFour[3].idx = 0
        topFour[3].weight = 1.0 - norm
        norm = 1.0
      }

      skinIndices.push(topFour[0].idx, topFour[1].idx, topFour[2].idx, topFour[3].idx)
      skinWeights.push(topFour[0].weight / norm, topFour[1].weight / norm, topFour[2].weight / norm, topFour[3].weight / norm)
    }

    this.mesh.geometry.setAttribute( 'skinIndex', new THREE.Uint16BufferAttribute( skinIndices, 4 ) );
    this.mesh.geometry.setAttribute( 'skinWeight', new THREE.Float32BufferAttribute( skinWeights, 4 ) );
  },
  keyframe(bone) {
    let frameIdx = this.currentFrameIdx()

    if (!(frameIdx in this.boneTracks[bone.name]))
    {
      this.boneTracks[bone.name][frameIdx] = new THREE.Matrix4()
    }
    this.boneTracks[bone.name][frameIdx].copy(bone.matrix)
  },
  currentFrameIdx() {
    return Compositor.component.currentFrame % this.data.frameCount
  },
  frameIdx(idx) {
    idx = idx % this.data.frameCount
    if (idx < 0) idx = this.data.frameCount + idx
    return idx
  },
  onFrameChange() {
    let frameIdx = this.currentFrameIdx()
    for (let bone of this.mesh.skeleton.bones)
    {
      if (this.boneToHandle[bone.name].is("grabbed")) continue

      let boneFrameIdx = frameIdx

      while (!(boneFrameIdx in this.boneTracks[bone.name]) && boneFrameIdx > 0)
      {
        boneFrameIdx--
      }

      if (boneFrameIdx in this.boneTracks[bone.name])
      {
        Util.applyMatrix(this.boneTracks[bone.name][boneFrameIdx], bone)
        this.boneToHandle[bone.name].components['bone-handle'].resetToBone()
      }
    }
  },
  bakeAnimations({name, wrap = true} = {}) {
    let tracks = []
    let fps = Compositor.component.data.frameRate
    for (let bone of this.mesh.skeleton.bones)
    {
      if (this.boneTracks[bone.name].length == 0) continue

      let times = []
      let positionValues = []
      let rotationValues = []
      for (let i in this.boneTracks[bone.name])
      {
        times.push(i / fps)

        let matrix = this.boneTracks[bone.name][i]

        let position = new THREE.Vector3
        position.setFromMatrixPosition(matrix)
        positionValues = positionValues.concat(position.toArray())

        let rotation = new THREE.Quaternion
        rotation.setFromRotationMatrix(matrix)
        rotationValues = rotationValues.concat(rotation.toArray())
      }

      if (wrap)
      {
        times.push(this.data.frameCount / fps)
        let matrix = this.boneTracks[bone.name].find(b => b)

        let position = new THREE.Vector3
        position.setFromMatrixPosition(matrix)
        positionValues = positionValues.concat(position.toArray())

        let rotation = new THREE.Quaternion
        rotation.setFromRotationMatrix(matrix)
        rotationValues = rotationValues.concat(rotation.toArray())
      }

      let positionTrack = new THREE.VectorKeyframeTrack(`${this.mesh.name}.bones[${bone.name}].position`, times, positionValues)
      let rotationTrack = new THREE.QuaternionKeyframeTrack(`${this.mesh.name}.bones[${bone.name}].quaternion`, times, rotationValues)
      tracks.push(positionTrack)
      tracks.push(rotationTrack)
    }
    if (!('animations' in this.mesh.parent))
    {
      this.mesh.parent.animations = []
    }
    this.mesh.parent.animations.push(new THREE.AnimationClip(name || shortid.generate(), (this.data.frameCount - 1) / fps, tracks))
  }
})

AFRAME.registerComponent("bone-handle", {
  events: {
    stateadded: function(e) {
      if (!e.target === this.el) return
      if (e.target.bone.name !== this.el.bone.name) return

      if (e.detail === 'grabbed')
      {
        this.stopGrabFrame = this.el.skeletonator.data.frameCount - 1 //this.el.skeletonator.frameIdx(this.el.skeletonator.currentFrameIdx() - 1)
        this.stopWrapsAround = false //(this.stopGrabFrame < this.el.skeletonator.currentFrameIdx())

        if (this.el.skeletonator.data.recordFrameCount) this.stopGrabFrame = Number.POSITIVE_INFINITY

        if (Compositor.component.isPlayingAnimation)
        {
          Compositor.component.jumpToFrame(0)
          this.el.skeletonator.boneTracks[this.el.bone.name] = []
        }
      }
    },
    stateremoved: function(e) {
      if (!e.target === this.el) return
      if (e.target.bone.name !== this.el.bone.name) return

      if (e.detail === 'grabbed')
      {
        if (this.el.skeletonator.data.recordFrameCount)
        {
          this.el.skeletonator.el.setAttribute('skeletonator', {frameCount: Compositor.component.currentFrame})
        }
      }
    }
  },
  init() {
    this.el.setAttribute('geometry', 'primitive: tetrahedron; radius: 0.02')
    this.el.setAttribute('grab-options', 'showHand: false')
    if (this.el.skeletonator.activeBone == this.el.bone)
    {
      this.el.setAttribute('material', 'color: #f5363f; shader: standard')
    }
    else
    {
      this.el.setAttribute('material', 'color: #c9f0f2; shader: standard')
    }
    // this.el.setAttribute('tooltip', this.el.bone.name)
    this.el.bone.matrix.decompose(this.el.object3D.position,
                                  this.el.object3D.rotation,
                                  this.el.object3D.scale)
  },
  tick(t,dt) {
    if (this.el.is("grabbed"))
    {
      this.el.object3D.matrix.decompose(this.el.bone.position, this.el.bone.rotation, this.el.bone.scale)

      if (this.el.skeletonator.data.recording)
      {
        if (Compositor.component.isPlayingAnimation)
        {
          if (this.stopWrapsAround && this.el.skeletonator.currentFrameIdx() < this.stopGrabFrame)
          {
            this.stopWrapsAround = false
          }

          if (!this.stopWrapsAround && Compositor.component.currentFrame >= this.stopGrabFrame)
          {
            this.el.grabbingManipulator.stopGrab()
            return
          }
        }

        this.el.skeletonator.keyframe(this.el.bone)
      }
    }
  },
  resetToBone()
  {
    if (this.el.is("grabbed")) return

    this.el.bone.matrix.decompose(this.el.object3D.position,
                                  this.el.object3D.rotation,
                                  this.el.object3D.scale)
  }
})

AFRAME.registerComponent("skeletonator-control-panel", {
  init() {
    Pool.init(this)
    this.el.querySelector('.globe-control')['redirect-grab'] = this.el.skeletonator.el
    this.el.addEventListener('click', e => {
      console.log("click", e)
      if (e.target.hasAttribute('click-action'))
      {
        let action = e.target.getAttribute('click-action')
        if (action in this) this[action](e)
      }
    })
    this.el.skeletonator.el.addEventListener('activebonechanged', e => {
      this.el.querySelector('.bone-name').setAttribute('text', {value: e.detail.activeBone.name})
    })
    this.el.querySelector('.bone-name').addEventListener('editfinished', e => {

      this.el.skeletonator.renameBone(this.el.skeletonator.activeBone, e.target.getAttribute('text').value)
    })
  },
  restPose() {
    this.el.skeletonator.mesh.skeleton.pose()
    this.el.skeletonator.updateHandles()
  },
  recordAnimation() {
    let numberOfFrames = 10
    let duration = numberOfFrames / Compositor.component.data.frameRate
    this.el.skeletonator.data.recording = true
  },
  bakeAnimations() {
    this.el.skeletonator.bakeAnimations({name: this.el.querySelector('.action-name').getAttribute('text').value})
  },
  exportSkinnedMesh() {
    this.el.skeletonator.mesh.material = Compositor.material
    this.el.sceneEl.systems["settings-system"].export3dAction(this.el.skeletonator.mesh.parent)
  },
  clearTracks() {
    for (let bone in this.el.skeletonator.boneTracks)
    {
      this.el.skeletonator.boneTracks = []
    }
  },
  bakeSkeleton() {
    let bones = []
    this.el.skeletonator.mesh.traverse(b => { if (b.type === 'Bone') bones.push(b) })
    this.el.skeletonator.mesh.bind(new THREE.Skeleton(bones), new THREE.Matrix4)
  },
  deleteActiveBone() {
    this.el.skeletonator.deleteBone(this.el.skeletonator.activeBone)
  },
  clearActiveBoneTracks() {
    this.el.skeletonator.boneTracks[this.el.skeletonator.activeBone.name] = []
  }
})

AFRAME.registerComponent("new-bone-wand", {
  schema: {
    radius: {default: 0.03},
    tipRatio: {default: 0.2},
  },
  events: {
    click: function() { this.addBone(); }
  },
  init() {
    Pool.init(this)
    this.el.classList.add('grab-root')
    this.el.setAttribute('grab-options', "showHand: false")

    let radius = this.data.radius
    let height = 0.3
    let tipHeight = height * this.data.tipRatio
    let cylinderHeight = height - tipHeight
    let cylinder = document.createElement('a-cylinder')
    this.height = height
    this.tipHeight = tipHeight
    cylinder.setAttribute('radius', radius)
    cylinder.setAttribute('height', cylinderHeight)
    cylinder.setAttribute('material', 'side: double; src: #asset-shelf; metalness: 0.4; roughness: 0.7')
    cylinder.classList.add('clickable')
    cylinder.setAttribute('propogate-grab', "")
    this.el.append(cylinder)

    let tip = document.createElement('a-entity')
    tip.setAttribute('geometry', 'primitive: tetrahedron; radius: 0.02')
    tip.setAttribute('position', `0 -${cylinderHeight / 2 + tipHeight / 2} 0`)
    this.el.append(tip)
    this.tip = tip

    this.el.skeletonator = document.querySelector('*[skeletonator]').components['skeletonator']
  },
  addBone() {
    console.log("Add bone", this)
    console.log("Adding bone to", this.el.skeletonator.activeBone)
    let skeletonator = this.el.skeletonator
    let skeleton = this.el.skeletonator.mesh.skeleton

    this.tip.object3D.updateMatrixWorld()
    let destMat = this.pool('dest', THREE.Matrix4)
    destMat.copy(this.tip.object3D.matrixWorld)

    let scale = this.pool('scale', THREE.Vector3)
    scale.setFromMatrixScale(destMat)
    scale.set(1.0 / scale.x, 1.0 / scale.y, 1.0 / scale.z)
    destMat.scale(scale)

    let invMat = this.pool('inv', THREE.Matrix4)

    let activeBone = this.el.skeletonator.activeBone

    if (activeBone)
    {
      activeBone.updateMatrixWorld()
      invMat.getInverse(activeBone.matrixWorld)
    }
    else
    {
      this.el.skeletonator.mesh.updateMatrixWorld()
      invMat.getInverse(this.el.skeletonator.mesh.matrixWorld)
    }

    destMat.premultiply(invMat)

    let bone = new THREE.Bone()
    bone.name = shortid.generate()
    Util.applyMatrix(destMat, bone)

    console.log("Bone", bone)

    if (activeBone)
    {
      activeBone.add(bone)
      skeletonator.boneToHandle[activeBone.name].append(skeletonator.addBoneHierarchy(bone))
    }
    else
    {
      skeleton.add(bone)
      skeletonator.el.append(skeletonator.addBoneHierarchy(bone))
    }

    skeletonator.setActiveBone(bone)

    // let bones = []
    // skeletonator.mesh.skeleton.bones[0].traverse(b => bones.push(b))
    // skeletonator.mesh.bind(new Three.Skeleton(bones), new THREE.Matrix4)
  }
})
