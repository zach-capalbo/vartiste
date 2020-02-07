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

    compositor.addEventListener('framechanged', (e) => {
      let activeLayer = document.getElementById('canvas-view').components.compositor.activeLayer
      this.el.querySelector('.frame-counter').setAttribute('text', {value: `Frame ${activeLayer.frameIdx(e.detail.frame) + 1} / ${activeLayer.frames.length} (${e.detail.frame})`})
    })
  }
})
