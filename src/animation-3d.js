import shortid from 'shortid'
import {Util} from './util.js'
import {Pool} from './pool.js'

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

    this.emitDetails.objectkeyframed.object = obj
    this.emitDetails.objectkeyframed.frameIdx = frameIdx
    this.el.emit('objectkeyframed', this.emitDetails.objectkeyframed)
  },
  clearTrack(obj) {
    delete this.frameIndices[obj.uuid]
    delete this.objectMatrixTracks[obj.uuid]

    this.emitDetails.objectkeyframed.object = obj
    this.emitDetails.objectkeyframed.frameIdx = -1
    this.el.emit('objectkeyframed', this.emitDetails.objectkeyframed)
  },
  deleteKeyframe(obj, frameIdx) {
    if (!(obj.uuid in this.objectMatrixTracks)) return
    this.objectMatrixTracks[obj.uuid].delete(frameIdx)
    this.frameIndices[obj.uuid].splice(this.frameIndices[obj.uuid].indexOf(frameIdx), 1)

    if (this.frameIndices[obj.uuid].length === 0)
    {
      delete this.frameIndices[obj.uuid]
      delete this.objectMatrixTracks[obj.uuid]
    }

    this.emitDetails.objectkeyframed.object = obj
    this.emitDetails.objectkeyframed.frameIdx = frameIdx
    this.el.emit('objectkeyframed', this.emitDetails.objectkeyframed)
  },
  wrappedFrameIndex(obj, frameIdx) {
    return Math.abs(frameIdx) % (this.frameIndices[obj.uuid][this.frameIndices[obj.uuid].length - 1] + 1)
  },
  currentFrameIdx(obj, wrap = true) {
    if (!this.frameIndices[obj.uuid]) return Compositor.component.currentFrame
    if (!wrap) return Compositor.component.currentFrame
    return this.wrappedFrameIndex(obj, Compositor.component.currentFrame)
    // return Compositor.component.currentFrame % this.data.frameCount
  },
  isWrapping(obj) {
    if (obj.el) obj = obj.el;
    if (!obj.hasAttribute('animation-3d-keyframed')) return true
    return obj.getAttribute('animation-3d-keyframed').wrapAnimation
  },
  // frameIdx(idx) {
  //   idx = idx % this.data.frameCount
  //   if (idx < 0) idx = this.data.frameCount + idx
  //   return idx
  // },
  animate(obj, {wrapAnimation = true, useGlobalNumberOfFrames = false} = {}) {
    if (!(obj.uuid in this.objectMatrixTracks)) return;

    let track = this.objectMatrixTracks[obj.uuid];
    let frameIdx = this.currentFrameIdx(obj, wrapAnimation)
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
      // console.log("Track", track)
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
        if (!wrapAnimation)
        {
          Util.applyMatrix(track.get(frameIndices[0]), obj)
          return;
        }
        startFrame = frameIndices[l - 1]
        endFrame = frameIndices[0] + frameCount
      }
      else if (frameIndices[l - 1] < frameIdx)
      {
        if (!wrapAnimation)
        {
          Util.applyMatrix(track.get(frameIndices[l - 1]), obj)
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

    this.el.object3D.traverseVisible(o => {
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
    })

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

    if (!animation3d.frameIndices) return;

    if (this.data.target)
    {
      let object = this.data.target.object3D || this.data.target
      if (object.uuid in animation3d.frameIndices)
      {
        let indices = animation3d.frameIndices[object.uuid]
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

    if (!(object.uuid in animation3d.frameIndices)) {
      for (let [frameIdx, el] of this.keyframes.entries())
      {
        el.remove()
        this.keyframes.delete(frameIdx)
      }
      return;
    }

    let indices = animation3d.frameIndices[object.uuid]

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
