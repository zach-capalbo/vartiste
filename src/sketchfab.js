CLIENT_ID = "A4LmXQbQlgtPZnmsmIokWVzQEum2Qb0ztF4gNMb1"
REDIRECT_URI = "https://zach-geek.gitlab.io/vartiste/index.html"
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
  upload() {
  }
})
