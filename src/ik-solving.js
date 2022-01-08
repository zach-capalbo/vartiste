import {Util} from './util.js'
import {Pool} from './pool.js'
import { IK, IKChain, IKJoint, IKBallConstraint, IKHelper } from './framework/three-ik.js';
import {setZForward} from './framework/three-ik-axis-util.js'
// import * as THREEIK from 'three-ik'
// window.THREEIK = THREEIK

window.ossos = require('ossos')
import {Armature, BipedRig} from 'ossos'

Util.registerComponentSystem('ik-solving', {
  init() {

  },
  setZForward(el) {
    console.log("Setting Z Forward on ", el)
    if (el) {
      el.object3D.traverse(o => {
        if (o.isSkinnedMesh && o.material.skinning)
        {
          setZForward(o.skeleton.bones[0])
          o.bind(o.skeleton)//, o.bindMatrix)
        }
      })
      return
    }

    for (let mesh of Skeletonator.meshes)
    {
      mesh.pose()
      setZForward(mesh.skeleton.bones[0])
      mesh.bind(mesh.skeleton)//, mesh.bindMatrix)
      // Skeletonator.bakeSkeleton()
    }

    for (let handle of Object.values(Skeletonator.boneToHandle))
    {
      handle.components['bone-handle'].resetToBone()
    }
  }
})

AFRAME.registerComponent('ik-handle-tool', {
  dependencies: ['selection-box-tool'],
  schema: {
    throttle: {default: 30},
    selector: {type: 'string', default: '#composition-view, .reference-glb'},
    ikLength: {default: 2},
  },
  events: {
    stateadded: function(e) {
      if (e.detail === 'grabbed') {

      }
    },
    stateremoved: function(e) {
      if (e.detail === 'grabbed') {

      }
    },
  },
  update(oldData) {
    this.el.setAttribute('selection-box-tool', 'grabElements', this.data.selector)
  },
  init() {
    this.bone = this.el.bone;
    // this.tick = AFRAME.utils.throttleTick(this.tick, this.data.throttle, this);
    this.el.setAttribute('selection-box-tool', 'grabElements', false);

    // this.boneToHandle[bone.name].components['bone-handle'].resetToBone()

    (function(ikComponent) {
      this.ikComponent = ikComponent
      this.ikBones = new Set();
      this.ikHelpers = [];
      this.selectObjects = function() {
        let objects = document.querySelectorAll(ikComponent.data.selector)
        let newObjects = []
        for (let el of objects)
        {
          Util.traverseFindAll(el.object3D, o => o.type === 'Bone', {outputArray: newObjects, visibleOnly: false})
        }
        objects = newObjects.map(o => { return {object3D: o}})
        console.log("Found bones to select", objects)
        return objects
      };

      this.originalStartGrab = this.startGrab;
      this.startGrab = function() {
        console.log("IK Start Grab")
        this.originalStartGrab();
        let allBones = new Set();
        this.ikBones.clear();
        for (let bone of Object.values(this.grabbed))
        {
          allBones.add(bone.object3D)
        }

        this.createRig(allBones)

        for (let bone of allBones)
        {
          let p = bone.parent
          let isRoot = true;
          for (let i = 1; i < ikComponent.data.ikLength; ++i)
          {
            if (allBones.has(p))
            {
              isRoot = false;
              break;
            }
          }
          if (!isRoot) continue;

          this.ikBones.add(bone)
        }

        for (let bone of this.ikBones)
        {
          this.createIK(bone, {target: this.grabbers[bone.uuid]});
        }
      };

      this.originalStopGrap = this.stopGrab;
      this.stopGrab = function() {
        this.originalStopGrap();

        // for (let helper of this.ikHelpers)
        // {
        //   helper.parent.remove(helper);
        // }
        // this.ikHelpers.length = 0;
      };

      this.preprocessContainedTarget = function (target) {
      };

      this._tick = (function(t, dt) {
        if (!this.el.is('grabbed')) return
        if (!this.grabbing) return

        if (this.ik) {
          this.ik.solve();

          for (let bone of this.ikBones)
          {
            let originalPos = this.pool('opos', THREE.Vector3)
            originalPos.copy(bone.position)

            Util.positionObject3DAtTarget(bone, this.grabbers[bone.uuid])
            bone.position.copy(originalPos)
            bone.matrix.compose(bone.position, bone.quaternion, bone.scale)
          }

          if (typeof Skeletonator !== 'undefined')
          {
            for (let chain of this.ik.chains)
            {
              for (let joint of chain.joints) {
                Skeletonator.boneToHandle[joint.bone.name].components['bone-handle'].resetToBone()
              }
            }
          }
        }
      }).bind(this);

      this.createIK = function (bone, {target}) {
        let boneChain = [];
        for (let i = 0; i < ikComponent.data.ikLength; ++i)
        {
          boneChain.push(bone);
          bone = bone.parent;
          if (!bone) break;
        }
        boneChain.reverse();

        this.rig

        this.el.sceneEl.object3D.add(helper)
      };
    }).call(this.el.components['selection-box-tool'], this);
  },
})

AFRAME.registerComponent('ossos-biped-rig', {
  schema: {
    restPoseType: {default: 'T', oneOf: ['A', 'T']}
  },
  init() {
    Pool.init(this)

    if (this.el.hasAttribute('skeletonator'))
    {
      this.isSkeletonator = true
      this.setupMesh(Skeletonator.mesh)
    }
    else
    {
      this.setupMesh(Util.traverseFind(this.el.object3D, o => o.skeleton))
    }
  },
  remove() {
    for (let targetEl of this.targets)
    {
      this.el.remove(targetEl)
      targetEl.destroy()
    }
  },
  setupMesh(mesh) {
    let skeleton = this.skeleton = mesh.skeleton

    let armature = this.armature = new Armature
    for (let b of skeleton.bones)
    {
      let pidx = skeleton.bones.indexOf(b.parent)
      armature.addBone(b.name, pidx < 0 ? null : pidx, b.quaternion.toArray(), b.position.toArray(), b.scale.toArray())
    }

    let rig = this.rig = new BipedRig
    rig.autoRig(armature)

    let pose = armature.newPose()
    this.basePose = pose

    if (this.data.restPoseType === 'A')
    {
      pose.rotLocal('LeftShoulder', -20)
      pose.rotLocal('LeftArm', -40)

      pose.rotLocal('RightShoulder', -20)
      pose.rotLocal('RightArm', -40)
    }

    pose.updateWorld()
    rig.bindPose(pose);
    rig.useSolversForRetarget( pose )
    this.updateSkeleton(pose)

    let ikPose = this.ikPose = armature.newPose()
    ikPose.updateWorld()

    this.targets = []
    this.setupIKLimbTarget(rig.armL, rig.handL, new THREE.Vector3(0, 0, 1))
    this.setupIKLimbTarget(rig.legL, rig.footL, new THREE.Vector3(0, 1, 0))
    this.setupIKLimbTarget(rig.armR, rig.handR, new THREE.Vector3(0, 0, 1))
    this.setupIKLimbTarget(rig.legR, rig.footR, new THREE.Vector3(0, 1, 0))

    this.setupIKLookTarget(rig.head, new THREE.Vector3(0, 1, 0))

  },
  setupIKLimbTarget(limb, joint, forward) {
    let targetEl = document.createElement('a-entity')
    this.el.append(targetEl)
    targetEl.setAttribute('gltf-model', '#asset-hand')
    targetEl.setAttribute('grabbable', '')
    let bone = this.skeleton.bones[joint.links[0].idx]

    targetEl.limb = limb
    targetEl.joint = joint
    targetEl.bone = bone
    targetEl.forward = forward

    Util.whenLoaded(targetEl, () => {
      Util.positionObject3DAtTarget(targetEl.object3D, bone)
      targetEl.object3D.scale.set(0.3, 0.3, 0.3)
      // targetEl.object3D.rotation.set(0, 0, 0)
      this.targets.push(targetEl)
    })

  },
  setupIKLookTarget(joint, forward) {
    let targetEl = document.createElement('a-entity')
    this.el.append(targetEl)
    targetEl.setAttribute('gltf-model', '#asset-hand')
    targetEl.setAttribute('grabbable', '')
    let bone = this.skeleton.bones[joint.links[0].idx]

    targetEl.joint = joint
    targetEl.bone = bone
    targetEl.armatureBone = this.ikPose.bones[joint.links[0].idx]
    targetEl.forward = forward
    targetEl.isLook = true

    Util.whenLoaded(targetEl, () => {
      Util.positionObject3DAtTarget(targetEl.object3D, bone, {transformOffset: {x: 0, y: 0, z: 0.1}})
      targetEl.object3D.scale.set(0.3, 0.3, 0.3)
      this.targets.push(targetEl)
    })
  },
  updateSkeleton(pose) {
    let skeleton = this.skeleton
    let basePose = this.basePose
    for (let i = 0; i < pose.bones.length; ++i)
    {
      skeleton.bones[i].position.set(...pose.bones[i].local.pos)
      if (isNaN(pose.bones[i].local.rot[0]))
      {
        skeleton.bones[i].quaternion.set(...basePose.bones[i].local.rot)
      }
      else
      {
        skeleton.bones[i].quaternion.set(...pose.bones[i].local.rot)
      }
      skeleton.bones[i].scale.set(...pose.bones[i].local.scl)
      skeleton.bones[i].updateMatrix()
      skeleton.bones[i].updateMatrixWorld()
    }
  },
  runSolvers() {
    let rig = this.rig
    let originalPosition = this.pool('position', THREE.Vector3)
    let originalScale = this.pool('scale', THREE.Vector3)
    let forward = this.pool('forward', THREE.Vector3)

    for (let targetEl of this.targets)
    {
      let target = targetEl.object3D

      if (targetEl.limb)
      {
        forward.copy(targetEl.forward)
        forward.applyQuaternion(target.quaternion)
        targetEl.limb.solver
          .setTargetPos( target.position.toArray() )
          .setTargetPole(forward.toArray())
          // .setTargetPole( [0,0, 1] )
      }
      else if (targetEl.isLook)
      {
        originalPosition.set(...targetEl.armatureBone.world.pos)
        originalPosition.sub(target.position).multiplyScalar(-1.0)
        targetEl.joint.solver
          .setTargetDir(originalPosition.toArray(), targetEl.forward.toArray())
      }
    }

    rig.resolveToPose( this.ikPose );
    this.updateSkeleton(this.ikPose)

    for (let targetEl of this.targets)
    {
      if (targetEl.isLook) continue;

      let target = targetEl.object3D
      let bone = targetEl.bone
      originalPosition.copy(bone.position)
      originalScale.copy(bone.scale)
      Util.positionObject3DAtTarget(bone, target)
      bone.position.copy(originalPosition)
      bone.scale.copy(originalScale)
    }
  },
  tick(t, dt) {
    if (this.ikPose)
    {
      this.runSolvers()

      if (this.isSkeletonator)
      {
        Skeletonator.updateHandles()
      }
    }
  }
})

window.OssosUtil = {
  setupMesh(mesh) {
    if (mesh === undefined) mesh = Skeletonator.mesh;
    let skeleton = mesh.skeleton

    let armature = this.armature = new Armature
    for (let b of skeleton.bones)
    {
      let pidx = skeleton.bones.indexOf(b.parent)
      armature.addBone(b.name, pidx < 0 ? null : pidx, b.quaternion.toArray(), b.position.toArray(), b.scale.toArray())
    }

    let rig = new BipedRig
    rig.autoRig(armature)

    let pose = armature.newPose()
    let basePose = pose
    pose.rotLocal('LeftShoulder', -20)
    pose.rotLocal('LeftArm', -40)

    pose.rotLocal('RightShoulder', -20)
    pose.rotLocal('RightArm', -40)

    pose.updateWorld()
    rig.bindPose(pose);
    rig.useSolversForRetarget( pose )

    let updateSkeleton = (pose) => {
      for (let i = 0; i < pose.bones.length; ++i)
      {

        skeleton.bones[i].position.set(...pose.bones[i].local.pos)
        if (isNaN(pose.bones[i].local.rot[0]))
        {
          skeleton.bones[i].quaternion.set(...basePose.bones[i].local.rot)
        }
        else
        {
          skeleton.bones[i].quaternion.set(...pose.bones[i].local.rot)
        }
        skeleton.bones[i].scale.set(...pose.bones[i].local.scl)
      }
    };

    updateSkeleton(pose)

    return {
      armature,
      rig,
      pose,
      updateSkeleton,
      rigMove: () => {
        let resolved = armature.newPose()
        const apos = [ 0.3, 0.6, -0.1 ];
        const lpos = [ 0.2, 0.1, 0.1 ];

        // Set Solvers with IK Data
        rig.armL.solver.setTargetPos( apos ).setTargetPole( [0,0,-1] );
        rig.armR.solver.setTargetPos( apos ).setTargetPole( [0,0,-1] );
        // rig.legL.solver.setTargetPos( lpos ).setTargetPole( [0.5,0,0.5] );
        // rig.footL.solver.setTargetDir( [0,0,1], [0,1,0] );
        // rig.spine.solver.setEndDir( [0,1,0], [0,0,1] ).setEndDir( [0,1,0], [0.5,0,0.5] );
        rig.head.solver.setTargetDir( [0,0.5,0.5], [0,1,0] );
        //
        // rig.hip.solver
        //     .setMovePos( [0,-0.3,0], false )
        //     .setTargetDir( [-0.5,0,0.5], [0,1,0] );

        rig.resolveToPose( resolved );
        updateSkeleton(resolved)
        return resolved;
      }
    }
  }
}
