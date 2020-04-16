CLIENT_ID = "A4LmXQbQlgtPZnmsmIokWVzQEum2Qb0ztF4gNMb1"
REDIRECT_URI = "https://zach-geek.gitlab.io/vartiste/index.html"
SKETCHFAB_API_URL = 'https://api.sketchfab.com/v3'
AFRAME.registerSystem('sketchfab', {
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
  async upload() {
    let modelFile = await this.el.systems['settings-system'].getExportableGLB()
    console.log("Uploading Model", modelFile)
    options = {
      name: this.el.systems['settings-system'].projectName,
      isInspectable: true,
      tags: ["vartiste"],
      isPublished: false,
      description: "Created in vartiste!",
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
      // mode: 'cors', // no-cors, *cors, same-origin
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
    }).then(function(response) {
      return response.json()
    })
    return response
    // return response.json(); // parses JSON response into native JavaScript objects
  }
})
