import {Util} from './util.js'
AFRAME.registerSystem('skeletonator-keyframes', {})

AFRAME.registerComponent('skeletonator-keyframes', {
  init() {
    this.needsReorganizing = false
    Util.whenLoaded(Skeletonator.el, () => {
      Skeletonator.el.addEventListener('activebonechanged', (e) => {
        this.setupBone(e.detail.activeBone)
      })
      Skeletonator.el.addEventListener('keyframeadded', (e) => {
        this.addKeyframe(e.detail.bone, e.detail.frame)
      })
      this.setupBone(Skeletonator.activeBone)
    })
  },
  setupBone(bone) {
    this.el.innerHTML = ""
    this.bone = bone
    for (let frame in Skeletonator.boneTracks[bone.name])
    {
      this.addKeyframe(bone, frame)
    }
  },
  addKeyframe(bone, frame) {
    if (bone !== this.bone) return;

    let frameEl = document.createElement('a-entity')
    frameEl.innerHTML = require('./partials/skeletonator-keyframes.html.slm')
    frameEl.setAttribute('frame-idx', frame)
    Util.whenLoaded(frameEl, () => {
      frameEl.querySelector('.frame-idx').setAttribute('text', 'value', frame)
      frameEl.addEventListener('click', (e) => {
        if (e.target.hasAttribute('click-action'))
        {
          this[e.target.getAttribute('click-action')]
        }
      })
      this.needsReorganizing = true
    })
    this.el.append(frameEl)
  },
  tick(t, dt) {
    if (this.needsReorganizing) {
      if (this.bone.name in Skeletonator.boneTracks)
      {
        for (let el of this.el.children)
        {
          el.setAttribute('position', `0 ${Object.keys(Skeletonator.boneTracks[this.bone.name]).indexOf(el.getAttribute('frame-idx'))} 0`)
        }
      }
      this.needsReorganizing = false
    }
  }
})
