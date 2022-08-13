import {Util} from './util.js'
import {POST_MANIPULATION_PRIORITY} from './manipulator.js'

AFRAME.registerComponent('cable-connector', {
  multiple: true,
  schema: {
    target: {type: 'selector'},
    numLinks: {default: 24},
    color: {type: 'color', default: '#333333'},
    lineWidth: {default: 0.01},
    sourceOffset: {default: new THREE.Vector3(0, 0, 0)},
    targetOffset: {default: new THREE.Vector3(0, 0, 0)},
  },
  init() {
    // this.tick = AFRAME.utils.throttleTick(this.tick, 100, this)
    this.catenary = this.catenary.bind(this)
    Util.whenLoaded([this.el, this.data.target], () => {this.tryInitialize()})
    // this.el.setAttribute('material', 'shader: matcap; matcap: #asset-matcap')
  },
  update(oldData) {
    let width = this.data.lineWidth
    const shape = this.shape = new THREE.Shape();
    shape.moveTo( 0,0 );
    shape.lineTo( 0, width );
    shape.lineTo( width, width );
    shape.lineTo( width, 0 );
    shape.lineTo( 0, 0 );
  },
  tryInitialize() {
    let targetEl = this.data.target

    this.el.sceneEl.systems.manipulator.installConstraint(targetEl, this.catenary, POST_MANIPULATION_PRIORITY)
    this.el.sceneEl.systems.manipulator.installConstraint(this.el, this.catenary, POST_MANIPULATION_PRIORITY)

    this.numLinks = 24
    this.links = []

    this.sourceConnection = this.el.object3D
    this.targetConnection = this.data.target.object3D


    for (let i = 0; i < this.numLinks; ++i)
    {
      this.links[i] = new THREE.Vector3
    }

    this.meshMaterial = new THREE.MeshBasicMaterial({color: '#030303'})//this.el.components.material.material

    console.log("Initialized cable")
    this.isInitialized = true
    Util.callLater(this.catenary)
  },
  // tick(t,dt) {
  //   if (!this.isInitialized) return
  //
  //   this.catenary()
  // },
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
    this.links[0].setFromMatrixPosition(this.destinationMatrix)
    this.links[0].add(this.data.sourceOffset)

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
    this.links[numLinks - 1].setFromMatrixPosition(this.destinationMatrix)
    this.links[numLinks - 1].add(this.data.targetOffset)

    this.targetForward = this.targetForward || new THREE.Vector3()
    this.targetConnection.getWorldDirection(this.targetForward)
    this.el.object3D.worldToLocal(this.targetForward)
    this.targetForward.normalize()
    this.targetForwardTemp = this.targetForwardTemp || new THREE.Vector3()

    let xRange = (this.links[numLinks - 1].x - this.links[0].x)
    let yRange = (this.links[numLinks - 1].y - this.links[0].y)
    let zRange = (this.links[numLinks - 1].z - this.links[0].z)

    var cableLength = 3
    var stretchFactor = 2

    let p1 = this.links[0]
    let p2 = this.links[numLinks - 1]

    let sourceDirectionInfluenceFalloff = 3;
    let targetDirectionInfluenceFalloff = 1.3

    let stiffnessAtsource = 3.2
    let stiffnessAttarget = 3.2

    for (let i = 1; i < numLinks - 1; ++i)
    {
      this.links[i].lerpVectors(this.links[0], this.links[numLinks - 1], i / (numLinks - 1))

      let stretchLength = Math.min(Math.sqrt((p2.x - p1.x) * (p2.x - p1.x) + (p2.y - p1.y) * (p2.y - p1.y)), length)
      let leftOver = cableLength - stretchLength
      let alpha = 1//Math.min(p1.y, p2.y) * Math.exp(- leftOver / stretchFactor)

      let fudge = - Math.min(p1.y, p2.y) + 2

      let dist = p2.y - p1.y
      let x0 = alpha * Math.acosh((p1.y + fudge) / alpha)
      let x1 = alpha * Math.acosh((p2.y + fudge) / alpha) +  x0
      let x = i / (numLinks - 1)

      this.links[i].y = alpha * Math.cosh((x1 * x - x0) / alpha) - fudge

      if (isNaN(this.links[i].y))
      {
        console.warn("NAN", alpha, p1.y, p2.y, x, leftOver, stretchFactor)
      }

      this.sourceForwardTemp.copy(this.links[0])
      this.sourceForwardTemp.addScaledVector(this.sourceForward, - stiffnessAtsource * ( i / (numLinks - 1.0)))
      this.links[i].lerp(this.sourceForwardTemp, Math.pow(1.0 - i / (numLinks - 1.0), sourceDirectionInfluenceFalloff))

      this.targetForwardTemp.copy(this.links[numLinks - 1])
      this.targetForwardTemp.addScaledVector(this.targetForward, stiffnessAttarget * (1.0 - i / (numLinks - 1.0)))
      this.links[i].lerp(this.targetForwardTemp, Math.pow(i / (numLinks - 1.0), targetDirectionInfluenceFalloff))
    }

    if (this.mesh)
    {
      this.mesh.parent.remove(this.mesh)
      this.mesh.geometry.dispose()
    }

    let geometry = new THREE.ExtrudeGeometry(this.shape, {
      bevelEnabled: false,
      steps: numLinks * 2,
      extrudePath: new THREE.CatmullRomCurve3(this.links)
    })
    this.mesh = new THREE.Mesh(geometry, this.meshMaterial)
    this.el.object3D.add(this.mesh)
  }
})
