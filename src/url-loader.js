AFRAME.registerSystem('url-loader', {
  init() {
    this.el.addEventListener('loaded', async e => {
      let params = new URLSearchParams(document.location.search)
      let url = params.get("load")
      if (!url) return

      console.info("Loading querystring url", url)

      let f = await fetch(url)
      this.el.systems['settings-system'].load(await f.text())
    })
  }
})
