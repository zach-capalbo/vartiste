import shortid from 'shortid'
import {Util} from './util.js'
import {Pool} from './pool.js'
import {CONSTRAINT_PRIORITY} from './manipulator.js'

class ObjectKeyframeTracks {
  constructor({
    id,
    initializer = () => new Object,
    parseValue = (a) => a,
  }) {
    this.objectTracks = {}
    this.frameIndices = {}
    this.initializer = initializer
    this.parseValue = parseValue
    this.id = id
  }
  at(obj, frameIdx) {
    if (!(obj.uuid in this.objectTracks))
    {
      this.objectTracks[obj.uuid] = new Map()
      this.frameIndices[obj.uuid] = []
    }

    if (!this.objectTracks[obj.uuid].has(frameIdx))
    {
      this.objectTracks[obj.uuid].set(frameIdx, this.initializer(obj, frameIdx))
      this.frameIndices[obj.uuid].push(frameIdx)
      this.frameIndices[obj.uuid].sort((a, b) => a - b)
    }

    return this.objectTracks[obj.uuid].get(frameIdx)
  }
  set(obj, frameIdx, value) {
    // To initialize
    this.at(obj, frameIdx)
    this.objectTracks[obj.uuid].set(frameIdx, value)
  }
  clear(obj) {
    delete this.frameIndices[obj.uuid]
    delete this.objectTracks[obj.uuid]
  }
  has(obj) {
    return obj.uuid in this.frameIndices
  }
  delete(obj, frameIdx) {
    if (!(obj.uuid in this.objectTracks)) return;
    this.objectTracks[obj.uuid].delete(frameIdx)
    this.frameIndices[obj.uuid].splice(this.frameIndices[obj.uuid].indexOf(frameIdx), 1)

    if (this.frameIndices[obj.uuid].length === 0)
    {
      delete this.frameIndices[obj.uuid]
      delete this.objectTracks[obj.uuid]
    }
  }
  checkIfNeeded(obj) {
    if (!(obj.uuid in this.frameIndices)) return false
    let values = new Set(this.objectTracks[obj.uuid].values())
    return values.size > 1

  }
  trimTo(obj, frameIdx, interpCallback) {
    if (!(obj.uuid in this.objectTracks)) return;
    if (this.frameIndices[obj.uuid].indexOf(frameIdx) < 0)
    {
      let val
      this.animate(obj, frameIdx, false, false, (v) => val = v, (x, a, b) => val = interpCallback(x, a, b))
      this.set(obj, frameIdx, val)
    }

    for (let i of this.frameIndices[obj.uuid])
    {
      if (i > frameIdx) {
        this.delete(obj, i)
      }
    }
  }
  wrappedFrameIndex(obj, frameIdx) {
    return Math.abs(frameIdx) % (this.frameIndices[obj.uuid][this.frameIndices[obj.uuid].length - 1] + 1)
  }
  currentFrameIdx(obj, wrap = true) {
    if (!this.frameIndices[obj.uuid]) return Compositor.component.currentFrame
    if (!wrap) return Compositor.component.currentFrame
    return this.wrappedFrameIndex(obj, Compositor.component.currentFrame)
    // return Compositor.component.currentFrame % this.data.frameCount
  }
  animate(obj, frameIdx, wrapAnimation, useGlobalNumberOfFrames, singleValueCallback, interpCallback) {
    if (!(obj.uuid in this.objectTracks)) return;

    let track = this.objectTracks[obj.uuid];

    if (track.has(frameIdx))
    {
      singleValueCallback(track.get(frameIdx))
    }
    else if (track.size === 0)
    {
      return;
    }
    else if (track.size === 1)
    {
      // console.log("Track", track)
      singleValueCallback(track.values().next().value)
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
        if (!wrapAnimation)
        {
          singleValueCallback(track.get(frameIndices[0]))
          return;
        }
        startFrame = frameIndices[l - 1]
        endFrame = frameIndices[0] + frameCount
      }
      else if (frameIndices[l - 1] < frameIdx)
      {
        if (!wrapAnimation)
        {
          singleValueCallback(track.get(frameIndices[l - 1]))
          return;
        }
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
      // console.log("Interp", frameIdx, startFrame, endFrame, frameCount)
      let interp = THREE.Math.mapLinear(frameIdx, startFrame, endFrame, 0.0, 1.0)

      interpCallback(interp, track.get(startFrame % frameCount), track.get(endFrame % frameCount))
      // Util.interpTransformMatrices(interp, track.get(startFrame % frameCount), track.get(endFrame % frameCount), {
      //   result: obj.matrix
      // })
      // Util.applyMatrix(obj.matrix, obj)
    }
  }

  readObjectTracks(obj, tracks, {recurse = true} = {}) {
    if (tracks)
    {
      let map = this.objectTracks[obj.uuid] = new Map();
      for (let [frameIdx, v] of tracks)
      {
        map.set(frameIdx, this.parseValue(v))
      }
      this.frameIndices[obj.uuid] = Array.from(map.keys())
      this.frameIndices[obj.uuid].sort((a, b) => a - b)
      if (obj.el) obj.el.setAttribute('animation-3d-keyframed', '')
    }
    if (recurse) this.readTracksFromUserData(obj)
  }
  readTracksFromUserData(obj) {
    obj.traverse(o => {
      if (o.userData.objectTracks && o.userData.objectTracks[this.id])
      {
        this.readObjectTracks(o, o.userData.objectTracks[this.id], {recurse: false})
        delete o.userData.objectTracks[this.id];
      }
    })
  }
  threeTrack(obj, fps, name, wrap, maxFrame, ctor, valueFn = (a) => [a]) {
    if (!(obj.uuid in this.frameIndices)) return null;

    let times = []
    let values = []
    let frames = this.frameIndices[obj.uuid]
    let lastFrame = frames[frames.length - 1] + 1
    let finalFrameIdx = 0
    let timesThrough = 0
    while (finalFrameIdx < maxFrame || !wrap) {
      for (let frameIdx of frames)
      {
        finalFrameIdx = (frameIdx + lastFrame * timesThrough)
        times.push(finalFrameIdx / fps)
        values.push(...valueFn(this.at(obj, frameIdx), frameIdx, finalFrameIdx / fps))
      }
      timesThrough++

      if (!wrap) break
    }

    if (times.length === 0) return null;

    return ctor(`${obj.uuid}.${name || this.id}`, times, values)
  }
}

Util.registerComponentSystem('animation-3d', {
  schema: {
    frameCount: {default: 50},
  },
  emits: {
    objectkeyframed: {
      object: null,
      frameIdx: 0
    },
  },
  init() {
    Pool.init(this)
    Util.emitsEvents(this)
    this.animations = []

    this.visibilityTracks = new ObjectKeyframeTracks({
      id: 'visibility',
      initializer: () => true,
    })

    this.matrixTracks = new ObjectKeyframeTracks({
      id: 'matrix',
      initializer: () => new THREE.Matrix4,
      parseValue: (a) => new THREE.Matrix4().fromArray(a.elements)
    })
  },
  trackFrameMatrix(obj, frameIdx) {
    return this.matrixTracks.at(obj, frameIdx)
  },
  allFrameIndices(obj) {
    return [].concat(this.matrixTracks.frameIndices[obj.uuid] || []).concat(this.visibilityTracks.frameIndices[obj.uuid] || [])
  },
  keyframe(obj, frameIdx = undefined) {
    if (frameIdx === undefined) frameIdx = Compositor.component.currentFrame//this.currentFrameIdx(obj)
    let matrix = this.trackFrameMatrix(obj, frameIdx)
    obj.updateMatrix()
    matrix.copy(obj.matrix)
    if (obj.el && !obj.el.hasAttribute('animation-3d-keyframed'))
    {
      obj.el.setAttribute('animation-3d-keyframed', '')
    }

    this.visibilityTracks.set(obj, frameIdx, obj.visible)

    this.emitDetails.objectkeyframed.object = obj
    this.emitDetails.objectkeyframed.frameIdx = frameIdx
    this.el.emit('objectkeyframed', this.emitDetails.objectkeyframed)
  },
  clearTrack(obj) {
    this.matrixTracks.clear(obj)
    this.visibilityTracks.clear(obj)

    this.emitDetails.objectkeyframed.object = obj
    this.emitDetails.objectkeyframed.frameIdx = -1
    this.el.emit('objectkeyframed', this.emitDetails.objectkeyframed)
  },
  deleteKeyframe(obj, frameIdx) {
    this.matrixTracks.delete(obj, frameIdx)
    this.visibilityTracks.delete(obj, frameIdx)

    this.emitDetails.objectkeyframed.object = obj
    this.emitDetails.objectkeyframed.frameIdx = frameIdx
    this.el.emit('objectkeyframed', this.emitDetails.objectkeyframed)
  },
  wrappedFrameIndex(obj, frameIdx) {
    return this.matrixTracks.wrappedFrameIndex(obj, frameIdx)
  },
  currentFrameIdx(obj, wrap = true) {
    if (!this.matrixTracks.frameIndices[obj.uuid]) return Compositor.component.currentFrame
    if (!wrap) return Compositor.component.currentFrame
    return this.wrappedFrameIndex(obj, Compositor.component.currentFrame)
    // return Compositor.component.currentFrame % this.data.frameCount
  },
  isWrapping(obj) {
    if (obj.el) obj = obj.el;
    if (!obj.hasAttribute) return false
    if (!obj.hasAttribute('animation-3d-keyframed')) return true
    return obj.getAttribute('animation-3d-keyframed').wrapAnimation
  },
  // frameIdx(idx) {
  //   idx = idx % this.data.frameCount
  //   if (idx < 0) idx = this.data.frameCount + idx
  //   return idx
  // },
  animate(obj, {wrapAnimation = true, useGlobalNumberOfFrames = false} = {}) {
    this.matrixTracks.animate(obj, this.matrixTracks.currentFrameIdx(obj, wrapAnimation), wrapAnimation, useGlobalNumberOfFrames,
      (m) => Util.applyMatrix(m, obj),
      (i, a, b) => {
        Util.interpTransformMatrices(i, a, b, {result: obj.matrix})
        Util.applyMatrix(obj.matrix, obj)
      }
    )
    this.visibilityTracks.animate(obj, this.visibilityTracks.currentFrameIdx(obj, wrapAnimation), wrapAnimation, useGlobalNumberOfFrames,
      (v) => obj.visible = v,
      (i, a, b) => obj.visible = a,
    )
  },

  writeableTracks(obj) {
    let foundAny = false
    let writable = {}
    for (let tracks of [this.visibilityTracks, this.matrixTracks])
    {
      if (!(obj.uuid in tracks.objectTracks)) continue
      writable[tracks.id] = Array.from(tracks.objectTracks[obj.uuid].entries())
      if (writable[tracks.id].length > 0) foundAny = true
    }

    return foundAny ? writable : null
  },
  addTracksToUserData(obj) {
    obj.traverse(o => {
      let tracks = this.writeableTracks(o)
      if (tracks)
      {
        o.userData.objectTracks = tracks
      }
    })
  },
  readObjectTracks(obj, trackTypes, {recurse = true} = {}) {
    if (!trackTypes) return;
    for (let [type, tracks] of Object.entries(trackTypes))
    {
      let key = type + 'Tracks'
      if (!this[key]) {
        console.warn("No known track for", key)
        continue
      }
      this[key].readObjectTracks(obj, tracks, {recurse})
    }
  },
  readTracksFromUserData(obj) {
    this.matrixTracks.readTracksFromUserData(obj)
    this.visibilityTracks.readTracksFromUserData(obj)
  },

  generateTHREETracks(obj, {wrap = false, maxFrame} = {}) {
    let tracks = []
    let fps = Compositor.component.data.frameRate
    let scaleTrack;

    if (this.matrixTracks.has(obj))
    {
      let times = []
      let positionValues = []
      let rotationValues = []
      let scaleValues = []
      let position = this.pool('position', THREE.Vector3)
      let rotation = this.pool('rot', THREE.Quaternion)
      let scale = this.pool('scale', THREE.Vector3)
      let frames = this.matrixTracks.frameIndices[obj.uuid]
      let lastFrame = frames[frames.length - 1] + 1
      let finalFrameIdx = 0
      let timesThrough = 0
      while (finalFrameIdx < maxFrame || !wrap) {
        for (let frameIdx of frames)
        {
          finalFrameIdx = (frameIdx + lastFrame * timesThrough)
          times.push(finalFrameIdx / fps)
          let matrix = this.trackFrameMatrix(obj, frameIdx)
          matrix.decompose(position, rotation, scale)
          positionValues.push(...position.toArray())
          rotationValues.push(...rotation.toArray())
          scaleValues.push(...scale.toArray())
        }
        timesThrough++

        if (!wrap) break;
      }


      let positionTrack = new THREE.VectorKeyframeTrack(`${obj.uuid}.position`, times, positionValues)
      scaleTrack = new THREE.VectorKeyframeTrack(`${obj.uuid}.scale`, times, scaleValues)
      let quaternionTrack = new THREE.QuaternionKeyframeTrack(`${obj.uuid}.quaternion`, times, rotationValues)
      tracks.push(positionTrack, scaleTrack, quaternionTrack)
    }

    // Grr... GLTF doesn't support visible target. If only....
    // let visibilityTracks = this.visibilityTracks.threeTrack(obj, fps, THREE.BooleanKeyframeTrack)
    // if (visibilityTracks) tracks.push(visibilityTracks)

    if (this.visibilityTracks.checkIfNeeded(obj))
    {
      if (scaleTrack)
      {
        tracks.splice(tracks.indexOf(scaleTrack), 1)
        let interpolant = scaleTrack.createInterpolant()
        scaleTrack = this.visibilityTracks.threeTrack(obj, fps, 'scale', wrap, maxFrame,
          (n, t, v) => new THREE.VectorKeyframeTrack(n,t,v, THREE.InterpolateDiscrete),
          (visible, frameIdx, t) => visible ? interpolant.evaluate(t) : [0.0, 0.0, 0.0]
        )
      }
      else
      {
        scaleTrack = this.visibilityTracks.threeTrack(obj, fps, 'scale', wrap, maxFrame,
          (n, t, v) => new THREE.VectorKeyframeTrack(n,t,v, THREE.InterpolateDiscrete),
          (visible) => visible ? [1.0, 1.0, 1.0] : [0.0, 0.0, 0.0]
        )
      }
      tracks.push(scaleTrack)
    }
    else if (scaleTrack) {

    }

    return tracks
  },
  generateAnimation(obj, {name} = {})
  {
    let tracks = []
    let maxTime = 0.0
    let maxFrame = 0
    obj.traverse(o => {
      maxFrame = Math.max(maxFrame, ...this.allFrameIndices(o))
    })
    console.log("Generating animation for max frame", maxFrame)
    obj.traverse(o => {
      let newTracks = this.generateTHREETracks(o, {maxFrame, wrap: this.isWrapping(o)})
      if (newTracks.length <= 0) return;

      maxTime = Math.max(maxTime, ...newTracks.map(t => t.times[t.times.length - 1]))
      tracks.push(...newTracks)
    })
    if (!name) name = `vartiste-${shortid.generate()}`
    let clip = new THREE.AnimationClip(name, maxTime, tracks)
    console.log("Animation Clip", clip)
    return clip
  },

  loadTHREEClip(obj, clip) {
    // let binding = new THREE.PropertyBinding(obj, clip.name)
    let fps = Compositor.component.data.frameRate
    let maxFrame = Math.round(clip.duration * fps)
    console.log("Loading", clip.name, maxFrame)
    let mixer = new THREE.AnimationMixer(obj)
    let action = mixer.clipAction(clip).play()
    for (let frameIdx = 0; frameIdx <= maxFrame; ++frameIdx)
    {
      Compositor.component.jumpToFrame(frameIdx)
      mixer.setTime(frameIdx / fps)
      obj.traverse(o => this.keyframe(o))
    }
  },
  loadModelAnimations(obj, animations) {
    console.log("Loading animations", animations, obj)
    for (let clip of animations)
    {
      this.loadTHREEClip(obj, clip)
    }
  }
})

AFRAME.registerComponent('animation-3d-keyframed', {
  schema: {
    puppeteering: {default: false},
    restartAnimationOnGrab: {default: true},

    wrapAnimation: {default: true},
    useGlobalNumberOfFrames: {default: false},

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

    this.el.object3D.traverse(o => {
      this.system.animate(o, this.data)
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


AFRAME.registerComponent('timeline-tool', {
  dependencies: ['grabbable', 'grab-root'],
  schema: {
    target: {type: 'selector'},
    loadAllKeyframes: {default: false},
  },
  init() {
    let width = 5
    let height = 0.1
    this.width = width
    this.height = height

    this.keyframes = new Map()

    let bg = new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshBasicMaterial({color: '#657B86'}))
    this.el.setObject3D('mesh', bg)

    let scrubber = this.scrubber = document.createElement('a-entity')
    scrubber.setAttribute('geometry', `primitive: box; width: 0.1; height: 0.2; depth: 0.2`)
    scrubber.setAttribute('material', 'shader: flat; color: #B97542')
    scrubber.setAttribute('grabbable', '')
    scrubber.setAttribute('grab-options', 'showHand: false')
    scrubber.setAttribute('action-tooltips', 'grab: Scrub timeline')
    this.el.append(scrubber)

    let wrappingScrubber = this.wrappingScrubber = document.createElement('a-entity')
    wrappingScrubber.setAttribute('geometry', `primitive: box; width: 0.08; height: 0.1; depth: 0.1`)
    wrappingScrubber.setAttribute('material', 'shader: flat; color: #598269')
    this.el.append(wrappingScrubber)

    this.el.sceneEl.systems['manipulator'].installConstraint(scrubber, () => {
      scrubber.object3D.position.y = 0
      scrubber.object3D.position.z = 0

      scrubber.object3D.rotation.set(0, 0, 0)

      let tickNumber = Math.round((scrubber.object3D.position.x - width / 2.0) / width * this.numTicks)
      scrubber.object3D.position.x = tickNumber / this.numTicks * width + width / 2.0
      let frameIdx = tickNumber + Math.floor(this.numTicks)
      if (Compositor.component.currentFrame !== frameIdx)
      {
        Compositor.component.jumpToFrame(frameIdx)
      }
    }, CONSTRAINT_PRIORITY)

    this.onFrameChange = this.onFrameChange.bind(this)
    this.onKeyframed = this.onKeyframed.bind(this)
    this.onPlayingChanged = this.onPlayingChanged.bind(this)
  },
  play() {
    this.updateTicks()
    this.el.sceneEl.addEventListener('objectkeyframed', this.onKeyframed)
    Compositor.el.addEventListener('framechanged', this.onFrameChange)
    Compositor.el.addEventListener('playpause', this.onPlayingChanged)
    this.onFrameChange()
  },
  pause() {
    this.el.sceneEl.removeEventListener('objectkeyframed', this.onKeyframed)
    Compositor.el.removeEventListener('framechanged', this.onFrameChange)
    Compositor.el.removeEventListener('playpause', this.onPlayingChanged)
  },
  update(oldData) {
    if (this.data.target)
    {
      if (this.targetEl)
      {
        this.targetEl.removeEventListener('stateremoved', this.onPlayingChanged)
      }

      this.object = this.data.target.object3D || this.data.target
      this.targetEl = this.object.el
      this.targetEl.addEventListener('stateremoved', this.onPlayingChanged)
    }
    this.updateTicks()
    if (this.data.loadAllKeyframes !== oldData.loadAllKeyframes && this.data.loadAllKeyframes)
    {
      this.updateKeyframes()
    }
  },
  updateTicks() {
    if (this.ticks)
    {
      this.ticks.parent.remove(this.ticks)
      this.ticks.geometry.dispose()
    }

    let width = this.width
    let numTicks = 10
    let animation3d = this.el.sceneEl.systems['animation-3d']

    if (this.data.target)
    {
      let object = this.data.target.object3D || this.data.target
      let frameIndices = animation3d.allFrameIndices(object)
      if (frameIndices.length > 0)
      {
        let indices = frameIndices
        numTicks = Math.min(Math.max(indices[indices.length - 1] + 5, 10), 50)
      }
    }

    this.numTicks = numTicks
    let tickGeometries = []
    let tickWidth = 0.03
    let tickHeight = 0.1
    let initialTickGeometry = new THREE.PlaneGeometry(tickWidth, tickHeight);
    let tickTransform = new THREE.Matrix4()
    tickTransform.makeTranslation(-width / 2.0, 0, 0)
    initialTickGeometry.applyMatrix4(tickTransform)
    tickTransform.makeTranslation(width / numTicks, 0, 0)
    for (let i = 0; i <= numTicks; ++i)
    {
      tickGeometries[i] = initialTickGeometry.clone()
      initialTickGeometry.applyMatrix4(tickTransform)
    }
    let ticks = this.ticks = new THREE.Mesh(THREE.BufferGeometryUtils.mergeBufferGeometries(tickGeometries, false), this.el.getObject3D('mesh').material)
    for (let t of tickGeometries)
    {
      t.dispose()
    }
    ticks.position.set(0, this.height / 2.0, 0)
    this.el.getObject3D('mesh').add(ticks)
  },
  updateKeyframes() {
    if (!this.data.target) return;

    let object = this.object
    let animation3d = this.el.sceneEl.systems['animation-3d']

    let frameIndices = animation3d.allFrameIndices(object);
    if (frameIndices.length === 0) {
      for (let [frameIdx, el] of this.keyframes.entries())
      {
        el.remove()
        this.keyframes.delete(frameIdx)
      }
      return;
    }

    let indices = frameIndices

    let usedKeyframes = new Set()

    if (indices.length < 10 || this.data.loadAllKeyframes)
    {
      if (this.loadAllButton) {
        this.loadAllButton.remove()
      }
      for (let frameIdx of indices)
      {
        let keyframe = this.keyframes.get(frameIdx)
        if (!keyframe)
        {
          keyframe = document.createElement('a-entity')
          this.el.append(keyframe)
          keyframe.setAttribute('timeline-keyframe', {target: this.data.target, frame: frameIdx})
          this.keyframes.set(frameIdx, keyframe)
        }

        keyframe.setAttribute('position', `${frameIdx / this.numTicks * this.width - this.width / 2.0} ${this.height * 2} 0`)
        usedKeyframes.add(frameIdx)
      }
    }
    else if (!this.data.loadAllKeyframes && !this.loadAllButton)
    {
      let loadAllButton = this.loadAllButton = document.createElement('a-entity')
      this.el.append(loadAllButton)
      loadAllButton.setAttribute('icon-button', '#asset-folder-open-outline')
      loadAllButton.setAttribute('tooltip', 'Load all keyframes')
      loadAllButton.setAttribute('toggle-button', {target: this.el, component: this.attrName, property: 'loadAllKeyframes'})
      loadAllButton.setAttribute('position', `0 ${this.height * 2} 0`)
    }

    for (let frameIdx of this.keyframes.keys())
    {
      if (usedKeyframes.has(frameIdx)) continue;
      let view = this.keyframes.get(frameIdx)
      view.remove()
      this.keyframes.delete(frameIdx)
    }
  },
  onFrameChange() {
    let animation3d = this.el.sceneEl.systems['animation-3d']
    let frameIdx = Compositor.component.currentFrame
    let wrappedIdx = animation3d.currentFrameIdx(this.object, animation3d.isWrapping(this.object))
    let width = this.width
    let numTicks = this.numTicks
    if (!this.scrubber.is('grabbed')) {
      this.scrubber.object3D.position.x = frameIdx / numTicks * width - width / 2
      this.scrubber.object3D.visible = this.scrubber.object3D.position.x >= - width / 2 && this.scrubber.object3D.position.x <= width / 2
    }
    this.wrappingScrubber.object3D.position.x = (wrappedIdx) / numTicks * width - width / 2
  },
  onKeyframed(e) {
    if (!this.data.target) return;
    if (e.detail.object !== this.data.target && e.detail.object !== this.data.target.object3D) return;

    if (Compositor.component.isPlayingAnimation && (this.data.target.el || this.data.target).is('grabbed'))
    {
      this.needsUpdate = true;
      return;
    }

    this.updateTicks()
    this.onFrameChange()
    this.updateKeyframes()
  },
  onPlayingChanged() {
    if (!this.needsUpdate) return

    this.updateTicks()
    this.onFrameChange()
    this.updateKeyframes()

    this.needsUpdate = false
  }
})

AFRAME.registerComponent('timeline-keyframe', {
  schema: {
    target: {type: 'selector'},
    frame: {default: 1}
  },
  events: {
    click: function(e) {
      if (!e.target.hasAttribute('click-action')) return;

      e.stopPropagation()
      this[e.target.getAttribute('click-action')](e)
    }
  },
  init() {
    this.el.innerHTML = require('./partials/timeline-keyframe.html.slm')
    // this.el.setAttribute('button-style', 'autoPosition: false')
    // this.el.setAttribute('icon-button', '')
  },
  update(oldData) {
    let frameText = this.el.querySelector('.frame-number')
    Util.whenLoaded(frameText, () => {
      frameText.setAttribute('icon-row-text', `${this.data.frame}`)
    })
  },
  applyKeyframe() {
    let animation3d = this.el.sceneEl.systems['animation-3d']
    let object = this.data.target.object3D || this.data.target
    Util.applyMatrix(animation3d.trackFrameMatrix(object, this.data.frame), object)
  },
  deleteKeyframe() {
    let animation3d = this.el.sceneEl.systems['animation-3d']
    let object = this.data.target.object3D || this.data.target
    animation3d.deleteKeyframe(object, this.data.frame)
  }
})

AFRAME.registerComponent('animation-3d-path', {
  schema: {
    target: {type: 'selector'}
  },
  init() {
    this.constructLine()
  },
  update(oldData) {
  },
  constructLine() {
    let object = this.data.target.object3D || this.data.target
    let points = []

  }
})
