var {HubsBot} = require("C:/Users/Admin/scripts/vr/hubs-client-bot")

class VartisteHubsConnector extends HubsBot {
  async setCanvasLocation({canvas}) {
    await this.evaluate((canvas) => {
      document.querySelectorAll('*[media-loader][networked]').forEach(async (el) => {
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

        el.object3D.scale.x *= canvas.width
        el.object3D.scale.y *= canvas.height

        console.log("Setting canvas matrix", this.canvasMatrix)
      })
    }, canvas)
  }
}

let bot = new VartisteHubsConnector({
  headless: false
})

bot.enterRoom(process.argv[2])

var app = require('express')();
var http = require('http').createServer(app);
var io = require('socket.io')(http);

io.on('connection', (socket) => {
  console.log('a user connected');
  bot.controlHands()

  socket.on('update', (data) => {
    bot.setAvatarLocations(data)
    bot.setCanvasLocation(data)
  })

  bot
    .evaluate(() => document.querySelector('#environment-scene *[gltf-model-plus]').getAttribute('gltf-model-plus').src)
    .then((scene) => socket.emit('scene', scene))
});

http.listen(3000, () => {
  console.log('listening on *:3000');
});
