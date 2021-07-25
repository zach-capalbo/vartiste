// var {HubsBot} = require("C:/Users/Admin/scripts/vr/hubs-client-bot")
var {HubsBot} = require("hubs-client-bot")
const BSON = require('bson')

// const PENCIL_URL = "https://uploads-prod.reticulum.io/files/f21745b0-cd0b-4055-bb19-4057f113e1f5.glb"
const PENCIL_URL = "https://uploads-prod.reticulum.io/files/cb90a707-8d49-478d-8a84-32190148b179.glb"

// const PAINTER_AVATAR = "https://hubs.mozilla.com/api/v1/avatars/g3TaUWh/avatar.gltf?v=63790793836"
const PAINTER_AVATAR = "https://xrtheater.live/api/v1/avatars/w4e2xe3/avatar.gltf?v=63792728168"

class VartisteHubsConnector extends HubsBot {
  async setCanvasLocation({canvas}) {
    await this.evaluate((canvas) => {
      document.querySelectorAll('*[media-loader][networked][media-video]').forEach(async (el) => {
        if (!/^hubs.*video$/.test(el.getAttribute('media-loader').src)) return
        if (!NAF.utils.isMine(el)) await NAF.utils.takeOwnership(el)

        // this.canvasPosition = this.canvasPosition || new THREE.Vector3
        // this.canvasPosition.set(canvas.position.x, canvas.position.y, canvas.position.z)
        // this.canvasPosition.add(document.querySelector('#avatar-rig').getAttribute('position'))
        // console.log("Setting canvas position", this.canvasPosition)
        // el.setAttribute('position', this.canvasPosition)

        this.canvasMatrix = this.canvasMatrix || new THREE.Matrix4()
        this.canvasMatrix.fromArray(canvas.matrix.elements)

        let rigObj = document.querySelector('#avatar-rig').object3D
        rigObj.updateMatrixWorld()
        this.canvasMatrix.premultiply(rigObj.matrixWorld)

        this.canvasMatrix.decompose(
          el.object3D.position,
          el.object3D.quaternion,
          el.object3D.scale
        )

        let video = el.components['media-video'].video

        if (!video) return;

        el.object3D.scale.x *=  (canvas.width / el.getObject3D('mesh').scale.x)
        el.object3D.scale.y *=  (canvas.height / el.getObject3D('mesh').scale.y)

        // console.log("Setting canvas matrix", this.canvasMatrix)
      })
    }, canvas)
  }
  async spawnTools() {
    if (this.spawned) return;
    this.spawned = true
    this.pencil = await this.spawnObject({
      url: PENCIL_URL,
      position: '0 0 0',
      dynamic: false,
      fitToBox: false,
    })

    await this.evaluate((pencilId) => {
      this.pencil = document.getElementById(pencilId)
      if (!this.pencil || !this.pencil.getObject3D('mesh')) return;
      this.pencil.getObject3D('mesh').rotation.x = Math.PI
    }, this.pencil)

    console.log("Spawned Pencil", this.pencil)
  }
  async setToolsLocation({tool}) {
    if (!tool || !tool.matrix) return;
    await this.evaluate((tool) => {
      if (!NAF.utils.isMine(this.pencil)) NAF.utils.takeOwnership(this.pencil)

      this.pencilMatrix = this.pencilMatrix || new THREE.Matrix4()
      this.pencilMatrix.fromArray(tool.matrix)

      let rigObj = document.querySelector('#avatar-rig').object3D
      rigObj.updateMatrixWorld()
      this.pencilMatrix.premultiply(rigObj.matrixWorld)

      this.pencilMatrix.decompose(
        this.pencil.object3D.position,
        this.pencil.object3D.quaternion,
        this.pencil.object3D.scale
      )

      this.pencil.object3D.scale.x *= 0.3
      this.pencil.object3D.scale.y *= 0.3
      this.pencil.object3D.scale.z *= 0.3
      this.pencil.object3D.updateMatrix()
      this.downscaled = true
    }, tool);
  }
  async fetchToolLocation() {
    return await this.evaluate(() => {
      if (!this.pencil) return;
      this.pencilMatrix = this.pencilMatrix || new THREE.Matrix4()

      let rigObj = document.querySelector('#avatar-rig').object3D
      rigObj.updateMatrixWorld()
      // this.pencilMatrix.copy(rigObj.matrixWorld)
      this.pencilMatrix.getInverse(rigObj.matrixWorld)


      this.pencil.object3D.scale.x /= 0.3
      this.pencil.object3D.scale.y /= 0.3
      this.pencil.object3D.scale.z /= 0.3

      this.pencil.object3D.updateMatrix()
      this.pencilMatrix.multiply(this.pencil.object3D.matrix)

      this.pencil.object3D.scale.x *= 0.3
      this.pencil.object3D.scale.y *= 0.3
      this.pencil.object3D.scale.z *= 0.3
      this.pencil.object3D.updateMatrix()

      return this.pencilMatrix.elements;

      // this.pencilMatrix.premultiply(rigObj.matrixWorld)
    })
  }
}

let bot = new VartisteHubsConnector({
  headless: false,
  name: "paint - pirate"
})

bot.enterRoom(process.argv[2], {manual: true}).then(() => {
  console.log("Setting avatar")
  bot.setAvatar(PAINTER_AVATAR)
})

var app = require('express')();
var http = require('http').createServer(app);
var whitelist = ['http://localhost:8080', 'https://vartiste.xyz']
var io = require('socket.io')(http, {
  cors: {
    origin: function (origin, callback) {
      if (whitelist.indexOf(origin) !== -1) {
        callback(null, true)
      } else {
        callback(new Error('Not allowed by CORS'))
      }
    }
  }
});

io.on('connection', (socket) => {
  console.log('a user connected');
  bot.controlHands()
  bot.spawnTools()
  bot.setAvatar(PAINTER_AVATAR)


  socket.on('update', (bindata, callback) => {
    // let data = BSON.deserialize(Buffer.from(bindata))
    let data = bindata
    bot.setAvatarLocations(data)
    bot.setCanvasLocation(data)
    bot.setToolsLocation(data)

    if (!data.tool.matrix) {
      bot.fetchToolLocation().then((tool) => {
        socket.emit('hubdate', {tool})
      })
    }
    callback()

  })

  // bot
  //   .evaluate(() => document.querySelector('#environment-scene *[gltf-model-plus]').getAttribute('gltf-model-plus').src)
  //   .then((scene) => {
  //     console.log("Fetching scene", scene)
  //     fetch(scene)
  //     .then(res => {
  //         const dest = fs.createWriteStream('./tmp/scene.gltf');
  //         res.body.pipe(dest);
  //     });
  //     socket.emit('scene', scene)
  //   })
});

app.get('')

http.listen(3000, () => {
  console.log('listening on *:3000');
});
