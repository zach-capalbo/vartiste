import {Util} from './util.js'
const MeshLine = require('./framework/meshline.js')

AFRAME.registerComponent('cable-connector', {
  schema: {
    target: {type: 'selector'},
    numLinks: {default: 24},
    color: {type: 'color', default: 0x333333},
    lineWidth: {default: 0.01},
  },
  init() {
    this.tick = AFRAME.utils.throttleTick(this.tick, 100, this)
    Util.whenLoaded([this.el, this.data.target], () => {this.tryInitialize()})
  },
  tryInitialize() {
    let targetEl = this.data.target

    this.numLinks = 24
    this.links = []

    this.sourceConnection = this.el.object3D
    this.targetConnection = this.data.target.object3D

    let geometry = new THREE.Geometry();
    let material = new MeshLine.MeshLineMaterial( {color: this.data.color, lineWidth: this.data.lineWidth} );

    for (let i = 0; i < this.numLinks; ++i)
    {
      geometry.vertices.push(new THREE.Vector3())
      this.links[i] = {position: geometry.vertices[i]}
    }

    this.innerGeometry = geometry
    this.cableLine = new MeshLine.MeshLine()
    this.cableLine.setGeometry(geometry)

    this.cableLineObject = new THREE.Mesh(this.cableLine.geometry, material)
    this.el.object3D.add(this.cableLineObject)
    this.cableLineObject.frustumCulled = false

    console.log("Initialized cable")
    this.isInitialized = true
  },
  tick(t,dt) {
    if (!this.isInitialized) return

    this.catenary()
  },
  catenary() {
    let numLinks = this.links.length;

    this.sourceConnection.updateMatrixWorld()
    this.destinationMatrix = this.destinationMatrix || new THREE.Matrix4()
    this.destinationMatrix.copy(this.sourceConnection.matrixWorld)

    this.scaleVector = this.scaleVector || new THREE.Vector3()

    this.inverseMatrix = this.inverseMatrix || new THREE.Matrix4()
    this.el.object3D.updateMatrixWorld()
    this.inverseMatrix.getInverse(this.el.object3D.matrixWorld)

    this.destinationMatrix.premultiply(this.inverseMatrix)
    // this.destinationMatrix.decompose(this.links[0].position, this.links[0].quaternion, this.scaleVector)
    this.links[0].position.setFromMatrixPosition(this.destinationMatrix)
    // this.links[0].updateMatrixWorld()

    this.sourceForward = this.sourceForward || new THREE.Vector3()
    this.sourceConnection.getWorldDirection(this.sourceForward)
    this.el.object3D.worldToLocal(this.sourceForward)
    this.sourceForward.normalize()
    this.sourceForwardTemp = this.sourceForwardTemp || new THREE.Vector3()


    // target
    this.targetConnection.updateMatrixWorld()
    this.destinationMatrix = this.destinationMatrix || new THREE.Matrix4()
    this.destinationMatrix.copy(this.targetConnection.matrixWorld)

    this.scaleVector = this.scaleVector || new THREE.Vector3()

    this.inverseMatrix = this.inverseMatrix || new THREE.Matrix4()
    this.el.object3D.updateMatrixWorld()
    this.inverseMatrix.getInverse(this.el.object3D.matrixWorld)

    this.destinationMatrix.premultiply(this.inverseMatrix)
    // this.destinationMatrix.decompose(this.links[numLinks-1].position, this.links[numLinks-1].quaternion, this.scaleVector)
    this.links[numLinks - 1].position.setFromMatrixPosition(this.destinationMatrix)
    // this.links[numLinks-1].updateMatrixWorld()

    this.targetForward = this.targetForward || new THREE.Vector3()
    this.targetConnection.getWorldDirection(this.targetForward)
    this.el.object3D.worldToLocal(this.targetForward)
    this.targetForward.normalize()
    this.targetForwardTemp = this.targetForwardTemp || new THREE.Vector3()

    let xRange = (this.links[numLinks - 1].position.x - this.links[0].position.x)
    let yRange = (this.links[numLinks - 1].position.y - this.links[0].position.y)
    let zRange = (this.links[numLinks - 1].position.z - this.links[0].position.z)

    var cableLength = 3
    var stretchFactor = 2

    let p1 = this.links[0].position
    let p2 = this.links[numLinks - 1].position

    let sourceDirectionInfluenceFalloff = 3;
    let targetDirectionInfluenceFalloff = 1.3

    let stiffnessAtsource = 3.2
    let stiffnessAttarget = 3.2

    for (let i = 1; i < numLinks - 1; ++i)
    {
      this.links[i].position.lerpVectors(this.links[0].position, this.links[numLinks - 1].position, i / (numLinks - 1))

      let stretchLength = Math.min(Math.sqrt((p2.x - p1.x) * (p2.x - p1.x) + (p2.y - p1.y) * (p2.y - p1.y)), length)
      let leftOver = cableLength - stretchLength
      let alpha = 1//Math.min(p1.y, p2.y) * Math.exp(- leftOver / stretchFactor)

      let fudge = - Math.min(p1.y, p2.y) + 2

      let dist = p2.y - p1.y
      let x0 = alpha * Math.acosh((p1.y + fudge) / alpha)
      let x1 = alpha * Math.acosh((p2.y + fudge) / alpha) +  x0
      let x = i / (numLinks - 1)

      this.links[i].position.y = alpha * Math.cosh((x1 * x - x0) / alpha) - fudge

      if (isNaN(this.links[i].position.y))
      {
        console.warn("NAN", alpha, p1.y, p2.y, x, leftOver, stretchFactor)
      }

      // this.links[i].position.addScaledVector(this.sourceForward, - (1.0 - i / (numLinks - 1)) / 6)
      // this.links[i].position.addScaledVector(this.targetForward, (i / (numLinks - 1.0)) / 3.0 )

      this.sourceForwardTemp.copy(this.links[0].position)
      this.sourceForwardTemp.addScaledVector(this.sourceForward, - stiffnessAtsource * ( i / (numLinks - 1.0)))
      this.links[i].position.lerp(this.sourceForwardTemp, Math.pow(1.0 - i / (numLinks - 1.0), sourceDirectionInfluenceFalloff))

      this.targetForwardTemp.copy(this.links[numLinks - 1].position)
      this.targetForwardTemp.addScaledVector(this.targetForward, stiffnessAttarget * (1.0 - i / (numLinks - 1.0)))
      this.links[i].position.lerp(this.targetForwardTemp, Math.pow(i / (numLinks - 1.0), targetDirectionInfluenceFalloff))
    }

    this.innerGeometry.verticesNeedUpdate = true
    this.cableLine.setGeometry(this.innerGeometry)
    this.cableLineObject.geometry.verticesNeedUpdate = true
  }
})
