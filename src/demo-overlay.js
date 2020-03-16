import {Axes} from './joystick-directions.js'

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
      this.data.hand.addEventListener(button + 'down', e => {
        part.material.color.set(this.data.pressedColor)
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
  },
  tock() {
    let camera = this.el.sceneEl.camera
    // if (!camera) return
    camera.getWorldPosition(this.el.object3D.position)
    camera.getWorldQuaternion(this.el.object3D.quaternion)
  }
})