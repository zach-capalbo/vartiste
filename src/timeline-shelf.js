AFRAME.registerComponent('timeline-shelf', {
  init() {
    this.el.addEventListener('click', (e) => {
      let compositor = document.getElementById('canvas-view').components.compositor
      let rawAction = e.target.getAttribute("click-action");
      let action = rawAction + "Action"
      if (action in this)
      {
        this[action](e)
      }
      else if (rawAction in compositor)
      {
        compositor[rawAction]()
      }
    })

    let compositor = document.getElementById('canvas-view');

    this.el.querySelector('.fps').addEventListener('editfinished', e=>{
      compositor.setAttribute('compositor', {frameRate: e.detail.value})
    })

    compositor.addEventListener('componentchanged', e => {
      if (e.detail.name === 'compositor')
      {
        this.el.querySelector('.fps').setAttribute('text', {value: compositor.getAttribute('compositor').frameRate})
      }
    })

    this.updateFrame = this.updateFrame.bind(this)
    compositor.addEventListener('framechanged', this.updateFrame)
    compositor.addEventListener('layerupdated', this.updateFrame)

    if (compositor.hasLoaded)
    {
      this.updateFrame()
    }
    else
    {
      compositor.addEventListener('componentinitialized', this.updateFrame)
    }
  },
  updateFrame()
  {
    let {activeLayer, currentFrame} = document.getElementById('canvas-view').components.compositor
    this.el.querySelector('.frame-counter').setAttribute('text', {value: `Frame ${activeLayer.frameIdx(currentFrame) + 1} / ${activeLayer.frames.length} (${currentFrame})`})
  },
  firstFrameAction()
  {
    document.getElementById('canvas-view').components.compositor.jumpToFrame(0)
  },
  recordAction()
  {
    this.el.sceneEl.systems['settings-system'].recordAction()
  }
})
