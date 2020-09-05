import {JoystickDirections, Axes} from './joystick-directions.js'

// Overlays two controllers attached to the camera that display which buttons
// are being pressed. Useful for HMD-screen capture demos. Currently only oculus
// touch controllers supported. Only enabled when `?demoMode=true` is appended
// to the URL
AFRAME.registerSystem('demo-overlay', {
  init() {
    let params = new URLSearchParams(document.location.search)
    let demo = params.get("demoMode")
    if (!demo) return

    console.info("Demo mode enabled")

    for (let hand of ['left', 'right'])
    {
      let overlay = document.createElement('a-entity')
      overlay.setAttribute('gltf-model', `https://cdn.aframe.io/controllers/oculus/oculus-touch-controller-${hand}.gltf`)
      overlay.setAttribute('demo-overlay', `hand: #${hand}-hand`)
      this.el.sceneEl.append(overlay)
    }
  }
})

AFRAME.registerComponent('demo-overlay', {
  schema: {
    hand: {type: 'selector'},
    defaultColor: {default: '#535963'},
    pressedColor: {default: '#aced7e'}
  },
  init() {
    this.el.addEventListener('model-loaded', e => {
      this.model = e.detail.model
      this.initializeModel()
    })
    // this.data.hand.addEventListener('model-loaded', e => {
    //   if (e.target !== this.data.hand) return
    //   console.log("controllermodelready", e)
    //   this.model = e.detail.model.clone()
    //   this.initializeModel()
    // })
  },
  initializeModel() {
    console.log("Initializing model")
    this.el.object3D.add(this.model)

    if (this.data.hand.id === 'right-hand')
    {
      this.model.position.set(0.25, -0.05, -0.3)
      this.model.rotation.set(1.8, -0.2, 0.4)
    }
    else
    {
      this.model.position.set(-0.15, -0.05, -0.3)
      this.model.rotation.set(1.8, -0.2, -0.4)
    }


    const buttonMap = {
      "buttonA": "abutton",
      "buttonB": "bbutton",
      "buttonX": "xbutton",
      "buttonY": "ybutton",
      "buttonTrigger": "trigger",
      "buttonHand": "grip",
      "stick": "thumbstick"
    }

    for (let modelPiece in buttonMap)
    {
      let part = this.model.children.find(m => m.name === modelPiece)
      if (!part) continue
      part.material = new THREE.MeshStandardMaterial({color: this.data.defaultColor})
      let button = buttonMap[modelPiece]
      let speakText = button
      if (button.endsWith("button"))
      {
        speakText = button[0]
      }
      else if (speakText === "grip")
      {
        speakText = "grab"
      }
      this.data.hand.addEventListener(button + 'down', e => {
        part.material.color.set(this.data.pressedColor)
        this.el.sceneEl.systems['speech'].speak(speakText)
      })
      this.data.hand.addEventListener(button + 'up', e => {
        part.material.color.set(this.data.defaultColor)
      })
    }

    let part = this.model.children.find(m => m.name === "body")
    part.material = new THREE.MeshStandardMaterial({color: "#333", transparent: true, opacity: 0.5})

    this.data.hand.addEventListener('axismove', e => {
      let {axis} = e.detail
      let part = this.model.children.find(m => m.name === "stick")

      if (axis.some(a => Math.abs(a) > 0.3)) {
        part.material.color.set(this.data.pressedColor)
        this.moved = true
      }
      else if (this.moved)
      {
        part.material.color.set(this.data.defaultColor)
        this.moved = false
      }
    })

    JoystickDirections.install({
      leftClick: () => this.el.sceneEl.systems.speech.speak("Left"),
      rightClick: () => this.el.sceneEl.systems.speech.speak("Right"),
      upClick: () => this.el.sceneEl.systems.speech.speak("Down"),
      downClick: () => this.el.sceneEl.systems.speech.speak("Up"),
    }, {targetEl: this.data.hand, whenGrabbing: true})
  },
  tock() {
    let camera = this.el.sceneEl.camera
    // if (!camera) return
    camera.getWorldPosition(this.el.object3D.position)
    camera.getWorldQuaternion(this.el.object3D.quaternion)
  }
})
