import shortid from 'shortid'
import {THREED_MODES} from "./layer-modes.js"
import {Util} from "./util.js"
import {Pool} from "./pool.js"

AFRAME.registerComponent('skeletonator', {
  schema: {
    recording: {default: true},
    frameCount: {default: 100},
  },
  init() {
    window.Skeletonator = this
    this.mesh = this.el.getObject3D('mesh').getObjectByProperty("type", "SkinnedMesh")

    if (!this.mesh)
    {
      console.log("Converting first mesh to skinned mesh")
      let firstMesh = this.el.getObject3D('mesh').getObjectByProperty("type", "Mesh")
      let skinnedMesh = new THREE.SkinnedMesh(firstMesh.geometry, firstMesh.material)

      let rootBone = new THREE.Bone()
      skinnedMesh.add(rootBone)

      skinnedMesh.bind(new THREE.Skeleton([rootBone]), new THREE.Matrix4())
      Util.applyMatrix(firstMesh.matrix, skinnedMesh)
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
  setupBones() {
    this.boneToHandle = {}
    this.boneTracks = {}

    if (this.mesh.skeleton.bones.length > 0)
    {
      this.el.append(this.addBoneHierarchy(this.mesh.skeleton.bones[0]))
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
  bakeAnimations() {
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

      let positionTrack = new THREE.VectorKeyframeTrack(`.bones[${bone.name}].position`, times, positionValues)
      let rotationTrack = new THREE.QuaternionKeyframeTrack(`.bones[${bone.name}].quaternion`, times, rotationValues)
      tracks.push(positionTrack)
      tracks.push(rotationTrack)
    }
    if (!('animations' in this.mesh))
    {
      this.mesh.animations = []
    }
    this.mesh.animations.push(new THREE.AnimationClip(shortid.generate(), this.data.frameCount / fps, tracks))
  }
})

AFRAME.registerComponent("bone-handle", {
  init() {
    this.el.setAttribute('geometry', 'primitive: tetrahedron; radius: 0.02')
    this.el.setAttribute('grab-options', 'showHand: false')
    this.el.setAttribute('material', 'color: #c9f0f2; shader: standard')
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
  },
  restPose() {
    this.el.skeletonator.mesh.skeleton.pose()
    this.el.skeletonator.updateHandles()
  },
  recordAnimation() {
    let numberOfFrames = 10
    let duration = numberOfFrames / Compositor.component.data.frameRate
    this.el.skeletonator.data.recording = true
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

  }
})
