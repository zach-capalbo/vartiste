AFRAME.registerSystem('url-loader', {
  init() {
    this.el.addEventListener('loaded', async e => {
      let params = new URLSearchParams(document.location.search)

      if (params.has('width') || params.has('height'))
      {
        let width = params.get('width') || Compositor.component.width
        let height = params.get('height') || Compositor.component.height
        Compositor.component.resize(parseInt(width), parseInt(height), {resample: true})
      }

      let url = params.get("load")
      if (url)
      {
        console.info("Loading querystring url", url)

        this.el.emit('open-popup', `Loading ${url}`)

        let compositor = document.getElementById('canvas-view').components.compositor
        let ctx = compositor.layers[0].canvas.getContext('2d')
        ctx.fillStyle = "#000"
        ctx.font = "58px Arial";
        ctx.fillText("Loading...", ctx.canvas.width / 2 - 40, ctx.canvas.height / 2)

        this.el.systems['file-upload'].handleURL(url)

        if (compositor.layers.some(l => l.frames.length > 1))
        {
          document.getElementById('canvas-view').components.compositor.playPauseAnimation()
        }
      }
    })
  }
})
