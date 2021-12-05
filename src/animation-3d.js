import {Util} from './util.js'

Util.registerComponentSystem('animation-3d', {
  schema: {
    frameCount: {default: 50},
  },
  init() {
    this.morphKeyFrames = {}
    this.animations = []
    this.objectMatrixTracks = {}
  },
  bakeMatrixListToClip(obj, animations) {
    let clip = new THREE.AnimationClip(shortid.generate(), (this.data.frameCount - 1 / fps), tracks)
  },
  trackFrameMatrix(obj, frameIdx) {
    if (!(obj.uuid in this.objectMatrixTracks))
    {
      this.objectMatrixTracks[obj.uuid] = new Map()
    }

    if (!this.objectMatrixTracks[obj.uuid].has(frameIdx))
    {
      this.objectMatrixTracks[obj.uuid].set(frameIdx, new THREE.Matrix4)
      // Util.callLater(() => this.el.emit('keyframeadded', this.emitDetails.keyframeadded))
    }

    return this.objectMatrixTracks[obj.uuid].get(frameIdx)
  },
  keyframe(obj) {
    let frameIdx = this.currentFrameIdx()
    let matrix = this.trackFrameMatrix(obj, frameIdx)
    obj.updateMatrix()
    matrix.copy(obj.matrix)
    if (obj.el && !obj.el.hasAttribute('animation-3d-keyframed'))
    {
      obj.el.setAttribute('animation-3d-keyframed', '')
    }
  },
  currentFrameIdx() {
    return Compositor.component.currentFrame % this.data.frameCount
  },
  frameIdx(idx) {
    idx = idx % this.data.frameCount
    if (idx < 0) idx = this.data.frameCount + idx
    return idx
  },
  animate(obj) {
    if (!(obj.uuid in this.objectMatrixTracks)) return;

    let track = this.objectMatrixTracks[obj.uuid];
    let frameIdx = this.currentFrameIdx()
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
      let frameIndices = Array.from(track.keys());
      frameIndices.sort((a, b) => a - b);
      let frameCount = this.data.frameCount;
      let l = frameIndices.length
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
        for (endFrame = frameIdx; endFrame <= this.data.frameCount; endFrame++)
        {
          if (track.has(endFrame)) break
        }
      }
      // console.log("Interp", frameIdx, startFrame, endFrame)
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
  }
})

AFRAME.registerComponent('animation-3d-keyframed', {
  schema: {
    puppeteering: {default: false},
    enabled: {default: true}
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
