// if (!this._posVec) this._posVec = new THREE.Vector3
// let posVec = this._posVec
// posVec.fromArray(pose.position)
//
// if (!this._linVec) this._linVec = new THREE.Vector3
// let linearVelocity = this._linVec
//
// if (pose.linearVelocity)
// {
//   linearVelocity.fromArray(pose.linearVelocity)
//
//   if (linearVelocity.length() < 1 && object3D.position.distanceTo(posVec) < 1)
//   {
//     object3D.position.copy(posVec);
//     // console.log("Far Out", pose)
//   }
//   // if (object3D.position.distanceTo(posVec) < 0.1){
//   // if (pose.velocity[0] < 1) {
//
//   // }


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

  if (pose.position) {
    this._hasHadPose = true
    const avgAmmount = 2
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
    console.log("No Pose")
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
}

AFRAME.registerComponent('smooth-controller', {
  // dependencies: ['tracked-controls-webvr'],
  schema: {  },
  init() {
    this.el.addEventListener('componentinitialized', (e) => {
      if (e.detail.name === 'tracked-controls-webvr') this.install()
    })
  },
  install() {
    console.log("Installing smooth controller")
    this.el.components['tracked-controls-webvr'].updatePose = updatePose
  }
})
