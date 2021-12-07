import shortid from 'shortid'
import {Util} from './util.js'
import {Pool} from './pool.js'

Util.registerComponentSystem('animation-3d', {
  schema: {
    frameCount: {default: 50},
  },
  init() {
    Pool.init(this)
    this.morphKeyFrames = {}
    this.animations = []
    this.objectMatrixTracks = {}
    this.frameIndices = {}
  },
  bakeMatrixListToClip(obj, animations) {
    let clip = new THREE.AnimationClip(shortid.generate(), (this.data.frameCount - 1 / fps), tracks)
  },
  trackFrameMatrix(obj, frameIdx) {
    if (!(obj.uuid in this.objectMatrixTracks))
    {
      this.objectMatrixTracks[obj.uuid] = new Map()
      this.frameIndices[obj.uuid] = []
    }

    if (!this.objectMatrixTracks[obj.uuid].has(frameIdx))
    {
      this.objectMatrixTracks[obj.uuid].set(frameIdx, new THREE.Matrix4)
      this.frameIndices[obj.uuid].push(frameIdx)
      this.frameIndices[obj.uuid].sort((a, b) => a - b)
      // Util.callLater(() => this.el.emit('keyframeadded', this.emitDetails.keyframeadded))
    }

    return this.objectMatrixTracks[obj.uuid].get(frameIdx)
  },
  keyframe(obj) {
    let frameIdx = Compositor.component.currentFrame//this.currentFrameIdx(obj)
    let matrix = this.trackFrameMatrix(obj, frameIdx)
    obj.updateMatrix()
    matrix.copy(obj.matrix)
    if (obj.el && !obj.el.hasAttribute('animation-3d-keyframed'))
    {
      obj.el.setAttribute('animation-3d-keyframed', '')
    }
  },
  currentFrameIdx(obj) {
    if (!this.frameIndices[obj.uuid]) return Compositor.component.currentFrame
    return Compositor.component.currentFrame % this.frameIndices[obj.uuid][this.frameIndices[obj.uuid].length - 1]
    // return Compositor.component.currentFrame % this.data.frameCount
  },
  // frameIdx(idx) {
  //   idx = idx % this.data.frameCount
  //   if (idx < 0) idx = this.data.frameCount + idx
  //   return idx
  // },
  animate(obj) {
    if (!(obj.uuid in this.objectMatrixTracks)) return;

    let track = this.objectMatrixTracks[obj.uuid];
    let frameIdx = this.currentFrameIdx(obj)
    if (track.has(frameIdx))
    {
      Util.applyMatrix(track.get(frameIdx), obj)
    }
    else if (track.size === 0)
    {
      return;
    }
    else if (track.size === 1)
    {
      console.log("Track", track)
      Util.applyMatrix(track.values().next().value, obj)
    }
    else
    {
      let frameIndices = this.frameIndices[obj.uuid]
      let l = frameIndices.length
      let frameCount = frameIndices[l - 1] + 1;//this.data.frameCount;
      let startFrame = 0
      let endFrame = l

      if (frameIndices[0] > frameIdx)
      {
        startFrame = frameIndices[l - 1]
        endFrame = frameIndices[0] + frameCount
      }
      else if (frameIndices[l - 1] < frameIdx)
      {
        startFrame = frameIndices[l - 1]
        endFrame = frameIndices[0] + frameCount
      }
      else
      {
        for (startFrame = frameIdx; startFrame >= 0; startFrame--)
        {
          if (track.has(startFrame)) break
        }
        for (endFrame = frameIdx; endFrame <= frameCount; endFrame++)
        {
          if (track.has(endFrame)) break
        }
      }
      console.log("Interp", frameIdx, startFrame, endFrame)
      let interp = THREE.Math.mapLinear(frameIdx, startFrame, endFrame, 0.0, 1.0)

      Util.interpTransformMatrices(interp, track.get(startFrame % frameCount), track.get(endFrame % frameCount), {
        result: obj.matrix
      })
      Util.applyMatrix(obj.matrix, obj)
    }
  },
  writeableTracks(obj) {
    if (!(obj.uuid in this.objectMatrixTracks)) return null;

    return Array.from(this.objectMatrixTracks[obj.uuid].entries())
  },
  addTracksToUserData(obj) {
    obj.traverse(o => {
      if (o.uuid in this.objectMatrixTracks)
      {
        o.userData.objectMatrixTracks = this.writeableTracks(o)
      }
    })
  },
  readObjectTracks(obj, tracks, {recurse = true} = {}) {
    if (tracks)
    {
      let map = this.objectMatrixTracks[obj.uuid] = new Map();
      for (let [frameIdx, mat] of tracks)
      {
        map.set(frameIdx, new THREE.Matrix4().fromArray(mat.elements))
      }
      this.frameIndices[obj.uuid] = Array.from(map.keys())
      this.frameIndices[obj.uuid].sort((a, b) => a - b)
      if (obj.el) obj.el.setAttribute('animation-3d-keyframed', '')
    }
    if (recurse) this.readTracksFromUserData(obj)
  },
  readTracksFromUserData(obj) {
    obj.traverse(o => {
      if (o.userData.objectMatrixTracks)
      {
        this.readObjectTracks(obj, o.userData.objectMatrixTracks, {recurse: false})
        delete o.userData.objectMatrixTracks;
      }
    })
  },
  generateTHREETracks(obj) {
    if (!(obj.uuid in this.objectMatrixTracks)) return []

    let times = []
    let positionValues = []
    let rotationValues = []
    let scaleValues = []
    let position = this.pool('position', THREE.Vector3)
    let rotation = this.pool('rot', THREE.Quaternion)
    let scale = this.pool('scale', THREE.Vector3)
    let frames = this.frameIndices[obj.uuid]
    let fps = Compositor.component.data.frameRate
    for (let frameIdx of frames)
    {
      times.push(frameIdx / fps)
      let matrix = this.trackFrameMatrix(obj, frameIdx)
      matrix.decompose(position, rotation, scale)
      positionValues.push(...position.toArray())
      rotationValues.push(...rotation.toArray())
      scaleValues.push(...scale.toArray())
    }

    // if (wrap)

    let positionTrack = new THREE.VectorKeyframeTrack(`${obj.uuid}.position`, times, positionValues)
    let rotationTrack = new THREE.VectorKeyframeTrack(`${obj.uuid}.scale`, times, scaleValues)
    let quaternionTrack = new THREE.QuaternionKeyframeTrack(`${obj.uuid}.quaternion`, times, rotationValues)
    return [positionTrack, rotationTrack, quaternionTrack]
  },
  generateAnimation(obj, {name} = {})
  {
    let tracks = []
    let maxTime = 0.0
    obj.traverse(o => {
      let newTracks = this.generateTHREETracks(o)
      if (newTracks.length <= 0) return;

      maxTime = Math.max(maxTime, newTracks[0].times[newTracks[0].times.length - 1])
      tracks.push(...newTracks)
    })
    if (!name) name = `vartiste-${shortid.generate()}`
    return new THREE.AnimationClip(name, maxTime, tracks)
  }
})

AFRAME.registerComponent('animation-3d-keyframed', {
  schema: {
    puppeteering: {default: false},
    restartAnimationOnGrab: {default: true},

    enabled: {default: true},
  },
  events: {
    stateadded: function(e) {
      if (this.data.enabled && this.data.puppeteering && this.data.restartAnimationOnGrab && e.detail === 'grabbed')
      {
        Compositor.component.jumpToFrame(0)
      }
    }
  },
  init() {
    this.system = this.el.sceneEl.systems['animation-3d']
  },
  play() {
    this.animate = this.animate.bind(this)
    Compositor.el.addEventListener('framechanged', this.animate)
  },
  pause() {
    Compositor.el.removeEventListener('framechanged', this.animate)
  },
  animate() {
    if (!this.data.enabled) return;
    if (this.el.is("grabbed")) return;

    this.el.object3D.traverseVisible(o => {
      this.system.animate(o)
    })
  },
  tick(t, dt) {
    // this.animate()
  },
  tock (t, dt) {
    if (this.data.puppeteering && this.el.is('grabbed'))
    {
      this.system.keyframe(this.el.object3D)
    }
  }
})
