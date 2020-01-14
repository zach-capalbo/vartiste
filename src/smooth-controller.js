function updatePose () {
  var controller = this.controller;
  var data = this.data;
  var object3D = this.el.object3D;
  var pose;
  var vrDisplay = this.system.vrDisplay;
  var standingMatrix;

  if (!controller) { return; }

  // Compose pose from Gamepad.
  pose = controller.pose;

  const avgAmmount = 1

  if (pose.position) {
    this._hasHadPose = true

    if (!this._poseVecs) {
      this._poseVecs = []
      for (let i = 0; i < avgAmmount; ++i)
      {
        this._poseVecs[i] = new THREE.Vector3
      }
    }
    this._poseVecs[avgAmmount - 1].fromArray(pose.position)

    for (let i = 1; i < avgAmmount; ++i)
    {
      this._poseVecs[0].add(this._poseVecs[i])
    }
    this._poseVecs[0].divideScalar(avgAmmount)
    object3D.position.copy(this._poseVecs[0])
    for (let i = 1; i < avgAmmount; ++i)
    {
      this._poseVecs[i - 1].copy(this._poseVecs[i])
    }
    // console.log(this._poseVecs)
  } else if (!this._hasHadPose){
    // Controller not 6DOF, apply arm model.
    if (data.armModel) { this.applyArmModel(object3D.position); }
  }

  if (pose.orientation) {
    // this._quart = this._quart || new THREE.Quaternion
    object3D.quaternion.fromArray(pose.orientation);
  }

  // Apply transforms, if 6DOF and in VR.
  if (vrDisplay && pose.position) {
    standingMatrix = this.el.sceneEl.renderer.xr.getStandingMatrix();
    object3D.matrix.compose(object3D.position, object3D.quaternion, object3D.scale);
    object3D.matrix.multiplyMatrices(standingMatrix, object3D.matrix);
    object3D.matrix.decompose(object3D.position, object3D.quaternion, object3D.scale);
  }

  object3D.rotateX(this.data.orientationOffset.x * THREE.Math.DEG2RAD);
  object3D.rotateY(this.data.orientationOffset.y * THREE.Math.DEG2RAD);
  object3D.rotateZ(this.data.orientationOffset.z * THREE.Math.DEG2RAD);

  if (!this._rotVecs) {
    this._rotVecs = []
    for (let i = 0; i < avgAmmount; ++i)
    {
      this._rotVecs[i] = new THREE.Vector3
    }
  }
  object3D.rotation.toVector3(this._rotVecs[avgAmmount - 1])

  for (let i = 1; i < avgAmmount; ++i)
  {
    this._rotVecs[0].add(this._rotVecs[i])
  }
  this._rotVecs[0].divideScalar(avgAmmount)
  object3D.rotation.setFromVector3(this._rotVecs[0])
  for (let i = 1; i < avgAmmount; ++i)
  {
    this._rotVecs[i - 1].copy(this._rotVecs[i])
  }
}

function updatePoseXR() {
  var object3D = this.el.object3D;
  var pose = this.pose;
  if (!pose) { return; }
  object3D.matrix.elements = pose.transform.matrix;
  object3D.matrix.decompose(object3D.position, object3D.rotation, object3D.scale);

  let orientationOffset = this.el.components['tracked-controls'].data.orientationOffset
  object3D.rotateX(orientationOffset.x * THREE.Math.DEG2RAD);
  object3D.rotateY(orientationOffset.y * THREE.Math.DEG2RAD);
  object3D.rotateZ(orientationOffset.z * THREE.Math.DEG2RAD);

  const avgAmmount = 4
  if (!this._poseVecs) {
    this._poseVecs = []
    for (let i = 0; i < avgAmmount; ++i)
    {
      this._poseVecs[i] = new THREE.Vector3
    }
  }
  this._poseVecs[avgAmmount - 1].copy(object3D.position)

  for (let i = 1; i < avgAmmount; ++i)
  {
    this._poseVecs[0].add(this._poseVecs[i])
  }
  this._poseVecs[0].divideScalar(avgAmmount)
  object3D.position.copy(this._poseVecs[0])
  for (let i = 1; i < avgAmmount; ++i)
  {
    this._poseVecs[i - 1].copy(this._poseVecs[i])
  }
}

AFRAME.registerComponent('smooth-controller', {
  // dependencies: ['tracked-controls-webvr'],
  schema: {  },
  init() {
    this.el.addEventListener('componentinitialized', (e) => {
      if (e.detail.name === 'tracked-controls-webvr') this.install()
      if (e.detail.name === 'tracked-controls-webxr') this.install()
    })
  },
  install() {
    console.log("Installing smooth controller")
    if (this.el.components['tracked-controls-webvr']) this.el.components['tracked-controls-webvr'].updatePose = updatePose
    if (this.el.components['tracked-controls-webxr']) this.el.components['tracked-controls-webxr'].updatePose = updatePoseXR
  }
})
