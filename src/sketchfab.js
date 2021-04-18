const {addImageReferenceViewer} = require('./file-upload.js');
const {Util} = require('./util.js')

const CLIENT_ID = "A4LmXQbQlgtPZnmsmIokWVzQEum2Qb0ztF4gNMb1"
const REDIRECT_URI = "https://zach-geek.gitlab.io/vartiste/index.html"
const SKETCHFAB_API_URL = 'https://api.sketchfab.com/v3'
Util.registerComponentSystem('sketchfab', {
  schema: {
    onlyMyModels: {default: false}
  },
  init() {
    let params = new URLSearchParams(document.location.toString().split("#")[1])
    let token = params.get("access_token")

    if (token)
    {
      console.log("Got sketchfab login token")
      localStorage.sketchfab_token = token
      this.token = token
    }
    else if (localStorage.sketchfab_token)
    {
      console.log("Loading sketchfab token from storage")
      this.token = localStorage.sketchfab_token
    }
  },
  login() {
     let url = `https://sketchfab.com/oauth2/authorize/?state=123456789&response_type=token&client_id=${CLIENT_ID}`
     this.el.systems['settings-system'].popup(url, "Sketchfab Login")
  },
  logout() {
    delete localStorage.sketchfab_token
    delete this.token
  },
  loggedIn() {
    return typeof this.token !== 'undefined'
  },
  async executeSearch() {
    let query = this.el.querySelector('#sketchfab-search-field').getAttribute('text').value
    Util.busy(() => this.handleSearchResults(this.search(query)), {title: `Searching for ${query}`})
  },
  async purchasedModels() {
    Util.busy(() => this.handleSearchResults(this.get('/me/models/purchases')), {title: "Sketchfab purchases"})
  },
  async myModels() {
    Util.busy(() => this.handleSearchResults(this.get('/me/models?count=14')), {title: "Load models"})
  },
  async handleSearchResults(queryPromise) {
    let resultEntity = this.el.querySelector('#sketchfab-search-results')
    for (let c of resultEntity.getChildEntities())
    {
      c.parentEl.removeChild(c)
    }

    let results = await queryPromise
    let row = document.createElement('a-entity')
    resultEntity.append(row)
    row.setAttribute('icon-row', '')
    let idx = 0
    for (let result of results.results)
    {
      let button = document.createElement('a-entity')
      row.append(button)
      button.setAttribute('icon-button', result.thumbnails.images.slice(-1)[0].url)
      button.setAttribute('tooltip', result.name)
      button.setAttribute('sketchfab-uid', result.uid)
      button.setAttribute('popup-action', 'close')

      button.addEventListener('click', () => this.download(result.uid, result))

      if (++idx % 8 == 0)
      {
        row = document.createElement('a-entity')
        resultEntity.append(row)
        row.setAttribute('icon-row', '')
      }
    }

    if (results.previous)
    {
      let next = document.createElement('a-entity')
      row.append(next)
      next.setAttribute('icon-button', '#asset-arrow-left')
      next.addEventListener('click', () => {
        this.handleSearchResults(this.get(results.previous.slice(SKETCHFAB_API_URL.length)))
      })
    }

    if (results.next)
    {
      let next = document.createElement('a-entity')
      row.append(next)
      next.setAttribute('icon-button', '#asset-arrow-right')
      next.addEventListener('click', () => {
        this.handleSearchResults(this.get(results.next.slice(SKETCHFAB_API_URL.length)))
      })
    }
  },
  async download(uid, result) {
    console.log("Importing", uid)
    let busy = this.el.sceneEl.systems['busy-indicator'].busy({title: "Downloading from Sketchfab"})
    this.addAttribution(result)
    let archiveInfo = await this.get(`/models/${uid}/download`)
    let zipUrl = archiveInfo.gltf.url
    let zipResponse = await fetch(zipUrl)
    let zip = await zipResponse.blob()
    zip.name = uid + ".zip"
    console.log("Got zip", zip)
    await this.el.sceneEl.systems['file-upload'].handleFile(zip)
    busy.done()
  },
  async addAttribution(result) {
    let info = await this.get(`/models/${result.uid}`)

    let canvas = document.createElement('canvas')
    canvas.width = 2048
    canvas.height = 768
    let ctx = canvas.getContext('2d')
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, 2048, 768)
    ctx.fillStyle = '#000'
    ctx.font = '48px sans'
    ctx.textBaseline = 'top'

    let lineHeight = 48
    let i = 0
    for (let line of `${info.name}\nBy ${info.user.displayName} (${info.user.username})\n\n${info.license.label}\n${info.license.requirements}\n${info.viewerUrl}`.split("\n"))
    {
      console.log(line, 5, 5 + lineHeight * i)
      ctx.fillText(line, 5, 5 + lineHeight * i++)
    }
    let viewer = addImageReferenceViewer(canvas)
    viewer.setAttribute('frame', 'closable: false')
  },
  async search(query) {
    if (this.data.onlyMyModels)
    {
      return await this.get(`/me/search?type=models&count=14&downloadable=true&q=${query}`)
    }
    else
    {
      return await this.get(`/search?type=models&count=14&downloadable=true&q=${query}`)
    }
  },
  async upload() {
    let modelFile = await this.el.systems['settings-system'].getExportableGLB()
    console.log("Uploading Model", modelFile)
    options = {
      name: this.el.systems['settings-system'].projectName,
      isInspectable: true,
      tags: ["vartiste"],
      isPublished: false,
      description: "Created in VARTISTE!",
      source: 'vartiste',
      // options: {
      //   shading: 'lit'
      // }
    }

    try {
      let result = await this.post('/models', options, {
        modelFile: {buffer: modelFile, name: this.el.systems['settings-system'].projectName + '.glb'}
      })

      let info = await fetch(result.uri).then(o => o.json())

      console.log("Sketchfab upload result", info)

      this.el.systems['settings-system'].popup(info.viewerUrl, "Sketchfab Upload")
    } catch (e) {
      console.error(e)
      this.el.sceneEl.emit('open-popup', "There was an error uploading. You may need to refresh this page and log in again.")
      throw e
    }
  },
  async post(route, data = {}, files) {
    let body = JSON.stringify(data)

    if (files)
    {
      body = new FormData()

      for (let key in data)
      {
        body.append(key, data[key])
      }

      for (let file in files)
      {
        let info = files[file]
        let blob = new Blob([new Uint8Array(info.buffer, 0, info.buffer.length)], {type: "model/gltf-binary"})
        blob.name = info.name
        body.append(file, blob, info.name)
      }

      console.log("Constructing form data", body)
    }

    const response = await fetch(SKETCHFAB_API_URL + route, {
      method: 'POST', // *GET, POST, PUT, DELETE, etc.
      mode: 'cors', // no-cors, *cors, same-origin
      // cache: 'no-cache', // *default, no-cache, reload, force-cache, only-if-cached
      // credentials: 'same-origin', // include, *same-origin, omit
      headers: {
        // 'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.token}`
        // 'Content-Type': 'application/x-www-form-urlencoded',
      },
      redirect: 'follow', // manual, *follow, error
      // referrerPolicy: 'no-referrer', // no-referrer, *client
      body: body
    }).then((response) => {
      if (response.status === 401)
      {
        console.warn("Sketchfab authorization invalid logging out")
        // Delete sketchfab token so we can reauthorize
        this.logout()
      }

      if (!response.ok)
      {
        console.error(response)
        throw Error("Could not post to sketchfab")
      }

      return response.json()
    })
    return response
    // return response.json(); // parses JSON response into native JavaScript objects
  },
  async get(route) {
    return await fetch(SKETCHFAB_API_URL + route, {
      method: 'GET', // *GET, POST, PUT, DELETE, etc.
      mode: 'cors', // no-cors, *cors, same-origin
      // cache: 'no-cache', // *default, no-cache, reload, force-cache, only-if-cached
      // credentials: 'same-origin', // include, *same-origin, omit
      headers: {
        // 'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.token}`
        // 'Content-Type': 'application/x-www-form-urlencoded',
      }
    }).then((response) => {
      if (response.status === 401)
      {
        console.warn("Sketchfab authorization invalid logging out")
        // Delete sketchfab token so we can reauthorize
        this.logout()
      }

      if (!response.ok)
      {
        console.error(response)
        throw Error("Could not get from sketchfab")
      }

      return response.json()
    })
  }
})

AFRAME.registerComponent('sketchfab-user-info', {
  dependencies: ['text'],
  init() {
    this.system = this.el.sceneEl.systems.sketchfab
    this.setInfo()
  },
  async setInfo() {
    let result = await this.system.get("/me")
    this.el.setAttribute('text', `value: Logged in as ${result.displayName} (${result.username})`)
  }
})
