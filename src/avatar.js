import {Util} from './util.js'
import {CAMERA_LAYERS} from './layer-modes.js'

var Tone;

Util.registerComponentSystem('avatar', {
  schema: {
    importAvatar: {default: false},
    leftHandEl: {type: 'selector', default: '#left-hand'},
    rightHandEl: {type: 'selector', default: '#right-hand'},
    debug: {default: false},
  },
  init() {
    this.intercept = this.intercept.bind(this)

    this.onGripClose = this.onGripClose.bind(this)
    this.onGripOpen = this.onGripOpen.bind(this)

    this.rightHandTransform = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(-Math.PI / 2, -Math.PI / 2, 0))
    this.leftHandTransform = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(-Math.PI / 2, Math.PI / 2, 0))

    this.hipTransform = new THREE.Matrix4().identity();
    this.headTransform = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(0, Math.PI, 0));
  },
  update(oldData) {
    if (this.data.importAvatar && !oldData.importAvatar)
    {
      console.log("Registering import avatar handler")
      this.el.sceneEl.systems['file-upload'].fileInterceptors.push(this.intercept)
    } else if (!this.data.importAvatar && oldData.importAvatar)
    {
      console.log("Clearing import avatar handler")
      this.el.sceneEl.systems['file-upload'].fileInterceptors.splice(this.el.sceneEl.systems['file-upload'].fileInterceptors.indexOf(this.intercept), 1)
    }

    if (this.data.leftHandEl !== oldData.leftHandEl)
    {
      if (oldData.leftHandEl)
      {
        oldData.leftHandEl.removeEventListener('gripup', this.onGripOpen)
        oldData.leftHandEl.removeEventListener('gripdown', this.onGripClose)
      }
      this.data.leftHandEl.addEventListener('gripup', this.onGripOpen)
      this.data.leftHandEl.addEventListener('gripdown', this.onGripClose)
    }

    if (this.data.rightHandEl !== oldData.rightHandEl)
    {
      if (oldData.rightHandEl)
      {
        oldData.rightHandEl.removeEventListener('gripup', this.onGripOpen)
        oldData.rightHandEl.removeEventListener('gripdown', this.onGripClose)
      }
      this.data.rightHandEl.addEventListener('gripup', this.onGripOpen)
      this.data.rightHandEl.addEventListener('gripdown', this.onGripClose)
    }
  },
  onGripClose(e) {
    let clip = e.target === this.data.rightHandEl ? this.rightGripAnim : this.leftGripAnim
    if (!clip) return;
    Util.callLater(() => clip.play())
  },
  onGripOpen(e) {
    let clip = e.target === this.data.rightHandEl ? this.rightGripAnim : this.leftGripAnim
    if (!clip) return;
    Util.callLater(() => clip.stop())
  },
  intercept(items) {
    console.log("Handling avatar")
    for (let i = 0; i < items.length; ++i)
    {
      let item = items[i];
      console.log("Checking", item, item instanceof Blob, item.kind)
      if (item.kind !== 'file' && !(item instanceof Blob)) continue
      let file = (item instanceof Blob) ? item : item.getAsFile()
      let isGLB = /\.(glb|vrm)$/i.test(file.name)
      console.log("IsGLB", isGLB)
      if (!isGLB) continue
      (async () => {
        let loader = new THREE.GLTFLoader()
        let buffer = await file.arrayBuffer()
        let model
        try {
          model = await new Promise((r, e) => loader.parse(buffer, "", r, e))
        }
        catch (e) {
          console.error("Could not load model", e)
          window.loadErrorBuffer = buffer
          return
        }
        console.log("Loaded Avatar", model)
        if (this.scene)
        {
          this.scene.parent.remove(this.scene)
        }
        this.scene = model.scene || model.scenes[0]
        this.animations = model.animations
        this.el.sceneEl.object3D.add(this.scene)
        this.scene.traverse(o => {
          if (!this.data.debug)
          {
            o.layers.disableAll()
            o.layers.enable(CAMERA_LAYERS.SPECTATOR)
          }

          o.frustumCulled = false

          if (!(o instanceof THREE.Mesh)) { return; }
          o.castShadow = true
          o.receiveShadow = true
        })

        this.leftHand = Util.traverseFind(this.scene, o => o.name === "LeftHand")
        this.rightHand = Util.traverseFind(this.scene, o => o.name === "RightHand")
        this.head = Util.traverseFind(this.scene, o => o.name === "Head")
        this.hips = Util.traverseFind(this.scene, o => o.name === 'Hips')

        if (this.head && this.hips)
        {
          let hipPos = new THREE.Vector3()
          let headPos = new THREE.Vector3()
          this.hips.getWorldPosition(hipPos)
          this.head.getWorldPosition(headPos)
          headPos.sub(hipPos)
          this.headToHip = headPos
        }

        this.mixer = null
        if (this.animations.length > 0)
        {
          this.mixer = new THREE.AnimationMixer(this.scene)
          let leftGripClip = this.animations.find(a => a.name === "allGrip_L")
          this.leftGripAnim = leftGripClip ? this.mixer.clipAction(leftGripClip) : null

          let rightGripClip = this.animations.find(a => a.name === "allGrip_R")
          this.rightGripAnim = rightGripClip ? this.mixer.clipAction(rightGripClip) : null

          this.mixer.setTime(10)
        }

        this.startAudioMonitoring()
      })();

      return true
    }
  },
  async startAudioMonitoring() {
    if (!Tone) {
      Tone = await import('tone')
    }

    const meter = new Tone.Meter({normalRange: true});
    const mic = new Tone.UserMedia().connect(meter);
    await mic.open()
    console.log("mic open");
    this.meter = meter
  },
  tick(t,dt) {
    if (!this.scene) return;

    if (this.mixer) {
      this.mixer.update(0)
    }

    if (!this.data.debug)
    {
      let cameraPosObj = Util.cameraObject3D()
      if (this.hips) {
        cameraPosObj.getWorldPosition(this.hips.position)
        this.hips.parent.worldToLocal(this.hips.position)
        this.hips.position.sub(this.headToHip)
        this.hips.rotation.y = Math.PI
      }

      if (this.head) {
        Util.positionObject3DAtTarget(this.head, cameraPosObj)
        this.head.matrix.multiply(this.headTransform)
        Util.applyMatrix(this.head.matrix, this.head)
      }
      if (this.leftHand) {
        Util.positionObject3DAtTarget(this.leftHand, this.data.leftHandEl.object3D)
        this.leftHand.matrix.multiply(this.leftHandTransform)
        Util.applyMatrix(this.leftHand.matrix, this.leftHand)
      }
      if (this.rightHand) {
        Util.positionObject3DAtTarget(this.rightHand, this.data.rightHandEl.object3D)
        this.rightHand.matrix.multiply(this.rightHandTransform)
        Util.applyMatrix(this.rightHand.matrix, this.rightHand)
      }

      if (this.leftHand && this.rightHand) {
        for (let el of [this.data.leftHandEl, this.data.rightHandEl]) {
          el.object3D.traverse(o => {
            o.layers.disable(CAMERA_LAYERS.DEFAULT)
            o.layers.disable(CAMERA_LAYERS.SPECTATOR)
            o.layers.enable(CAMERA_LAYERS.LEFT_EYE)
            o.layers.enable(CAMERA_LAYERS.RIGHT_EYE)
          })
        }
      }
    }

    if (this.meter) {
      let level = this.meter.getValue();

      level = Math.min(1.0, level * 5);

      // Why not.....
      // this.el.sceneEl.systems['paint-system'].selectOpacity(level)

      this.scene.traverse(o => {
        let hubsData = o.userData.hubs_component_morph_audio_feedback;
        if  (o.userData.gltfExtensions && o.userData.gltfExtensions.MOZ_hubs_components) hubsData = o.userData.gltfExtensions.MOZ_hubs_components['morph-audio-feedback']
        if (!hubsData) return;

        let mappedLevel = THREE.MathUtils.mapLinear(level, 0, 1, hubsData.minValue, hubsData.maxValue)

        // console.log("Setting morph data", o, level, mappedLevel)

        o.morphTargetInfluences[o.morphTargetDictionary[hubsData.name]] = mappedLevel;
      })
    }
  }
})
