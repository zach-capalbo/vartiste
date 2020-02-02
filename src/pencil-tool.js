AFRAME.registerComponent('pencil-tool', {
  schema: {
    throttle: {type: 'int', default: 30},
    scaleTip: {type: 'boolean', default: true},
    pressureTip: {type: 'boolean', default: false},
  },
  init() {
    this.el.classList.add('grab-root')

    let radius = 0.03
    let height = 0.3
    let tipHeight = height * 0.2
    let cylinderHeight = height - tipHeight
    let cylinder = document.createElement('a-cylinder')
    this.height = height
    this.tipHeight = tipHeight
    cylinder.setAttribute('radius', radius)
    cylinder.setAttribute('height', cylinderHeight)
    cylinder.setAttribute('material', 'side: double; src: #asset-shelf; metalness: 0.4; roughness: 0.7')
    // cylinder.setAttribute('position', `0 ${tipHeight / 2} 0`)
    cylinder.classList.add('clickable')
    cylinder.setAttribute('propogate-grab', "")
    this.el.append(cylinder)

    let tip;

    if (this.data.pressureTip)
    {
      tip = document.createElement('a-sphere')
      tip.setAttribute('radius', radius)
    }
    else if (this.data.scaleTip)
    {
      tip = document.createElement('a-cone')
      tip.setAttribute('radius-top', radius)
      tip.setAttribute('radius-bottom', 0)
    }
    else
    {
      tip = document.createElement('a-cylinder')
      tip.setAttribute('radius', radius / 2)
    }
    tip.setAttribute('height', tipHeight)
    tip.setAttribute('position', `0 -${cylinderHeight / 2 + tipHeight / 2} 0`)
    tip.setAttribute("show-current-color", "")
    tip.classList.add('clickable')
    tip.setAttribute('propogate-grab', "")
    this.el.append(tip)

    this.el.setAttribute('raycaster', `objects: .canvas; showLine: false; direction: 0 -1 0; origin: 0 -${cylinderHeight / 2} 0; far: ${tipHeight}`)

    this.el.addEventListener('raycaster-intersection', e => {
      console.log("Hand draw initialized")
      this.updateDrawTool()
      this.el.components['hand-draw-tool'].isDrawing = true
      this.el.components['hand-draw-tool'].startDraw()
    })

    this.el.addEventListener('raycaster-intersection-cleared', e => {
      this.el.components['hand-draw-tool'].endDraw()
    })

    this.el.setAttribute('hand-draw-tool', "")

    this._tick = this.tick
    this.tick = AFRAME.utils.throttleTick(this.tick, this.data.throttle, this)
  },
  updateDrawTool() {
    let far = this.tipHeight * this.el.object3D.scale.x
    this.el.setAttribute('raycaster', {far})
    let handDrawTool = this.el.components['hand-draw-tool']
    let intersection = this.el.components.raycaster.intersections.sort(i => navigator.xr ? i.distance : - i.distance)[0]

    if (intersection)
    {
      let ratio = intersection.distance / far
      if (this.data.scaleTip)
      {
        handDrawTool.distanceScale = THREE.Math.lerp(1.0, 0.1, ratio)
      }
      else
      {
        handDrawTool.distanceScale = 1.0
      }

      if (this.data.pressureTip)
      {
        handDrawTool.pressure = THREE.Math.lerp(1.0, 0.1, ratio)
      }
      else
      {
        this.el.components['hand-draw-tool'].pressure = 1.0
      }
    }
  },
  tick() {
    if (!this.el.is("grabbed")) return

    let handDrawTool = this.el.components['hand-draw-tool']
    if (!handDrawTool.isDrawing) return
    this.updateDrawTool()
  }
})
