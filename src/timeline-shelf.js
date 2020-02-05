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

    compositor.addEventListener('framechanged', (e) => {
      let activeLayer = document.getElementById('canvas-view').components.compositor.activeLayer
      this.el.querySelector('.frame-counter').setAttribute('text', {value: `Frame ${activeLayer.frameIdx(e.detail.frame) + 1} / ${activeLayer.frames.length} (${e.detail.frame})`})
    })
  }
})
