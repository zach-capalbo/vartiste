import {Util} from './util.js'
import { IK, IKChain, IKJoint, IKBallConstraint, IKHelper } from './framework/three-ik.js';
import {setZForward} from './framework/three-ik-axis-util.js'
// import * as THREEIK from 'three-ik'
// window.THREEIK = THREEIK

Util.registerComponentSystem('ik-solving', {
  init() {

  },
  setZForward(el) {
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

const constraints = [new THREE.IKBallConstraint(180)];
AFRAME.registerComponent('ik-handle-tool', {
  dependencies: ['selection-box-tool'],
  schema: {
    throttle: {default: 30},
    selector: {type: 'string', default: '#composition-view, .reference-glb'},
    ikLength: {default: 3},
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
        this.zCorrectedEls = new Set();
        this.originalStartGrab();
        let allBones = new Set();
        this.ikBones.clear();
        for (let bone of Object.values(this.grabbed))
        {
          allBones.add(bone.object3D)
        }

        this.ik = new IK();
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
        delete this.ik;
        for (let helper of this.ikHelpers)
        {
          helper.parent.remove(helper);
        }
        this.ikHelpers.length = 0;
      };

      this.preprocessContainedTarget = function (target) {
        if (this.zCorrectedEls.has(target.object3D.el)) return;

        this.el.sceneEl.systems['ik-solving'].setZForward(target.object3D.el);

        this.zCorrectedEls.add(target.object3D.el)
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

        let ikchain = new IKChain()
        for (let i = 0; i < boneChain.length; ++i)
        {
          ikchain.add(
            new IKJoint(boneChain[i], {constraints}),
            { target: i === boneChain.length - 1 ? target : null});
        }

        console.log("Created IK Chain for", bone, ikchain, target)

        this.ik.add(ikchain)

        let helper = new IKHelper(this.ik);
        this.ikHelpers.push(helper);
        this.el.sceneEl.object3D.add(helper)
      };
    }).call(this.el.components['selection-box-tool'], this);
  },
})
