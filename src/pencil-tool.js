import {Sfx} from './sfx.js'

AFRAME.registerComponent('pencil-tool', {
  schema: {
    throttle: {type: 'int', default: 30},
    scaleTip: {type: 'boolean', default: true},
    pressureTip: {type: 'boolean', default: false},

    radius: {default: 0.03},
    tipRatio: {default: 0.2},
    extraStates: {type: 'array'},

    enabled: {default: true}
  },
  init() {
    this.el.classList.add('grab-root')

    for (let s of this.data.extraStates)
    {
      this.el.addState(s)
    }

    let radius = this.data.radius
    let height = 0.3
    let tipHeight = height * this.data.tipRatio
    let cylinderHeight = height - tipHeight
    let cylinder = document.createElement('a-cylinder')
    this.height = height
    this.tipHeight = tipHeight
    cylinder.setAttribute('radius', radius)
    cylinder.setAttribute('height', cylinderHeight)
    cylinder.setAttribute('material', 'side: double; src: #asset-shelf; metalness: 0.4; roughness: 0.7')
    cylinder.classList.add('clickable')
    cylinder.setAttribute('propogate-grab', "")
    this.el.append(cylinder)

    let tip;

    if (this.data.pressureTip)
    {
      tip = document.createElement('a-sphere')
      tip.setAttribute('radius', tipHeight / 2)
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

    if (this.el.is("erasing"))
    {
      tip.setAttribute('material', 'metalness: 0; roughness: 0.9; color: #eee')
    }
    else
    {
      tip.setAttribute("show-current-color", "")
    }
    tip.classList.add('clickable')
    tip.setAttribute('propogate-grab', "")
    this.el.append(tip)
    tip.setAttribute('material', 'side: double')
    this.tip = tip

    let brushPreview = document.createElement('a-plane')
    brushPreview.setAttribute("show-current-brush", "")
    brushPreview.setAttribute('width', radius)
    brushPreview.setAttribute('height', radius)
    brushPreview.setAttribute('rotation', '-90 0 0')
    brushPreview.setAttribute('position', `0 ${cylinderHeight / 2 + 0.0001} 0`)
    this.el.append(brushPreview)


    this.el.setAttribute('raycaster', `objects: .canvas; showLine: false; direction: 0 -1 0; origin: 0 -${cylinderHeight / 2} 0; far: ${tipHeight}`)
    this.el.object3D.up.set(0, 0, 1)

    this.el.addEventListener('raycaster-intersection', e => {
      if (!this.data.enabled) return
      this.updateDrawTool()
      this.el.components['hand-draw-tool'].isDrawing = true
      this.el.components['hand-draw-tool'].startDraw()
    })

    this.el.addEventListener('raycaster-intersection-cleared', e => {
      if (!this.data.enabled) return
      this.el.components['hand-draw-tool'].endDraw()
      this.el.components['hand-draw-tool'].isDrawing = false
    })

    this.el.setAttribute('hand-draw-tool', "")
    this.el.setAttribute('grab-options', "showHand: false")

    this.el.addEventListener('click', e => {
      if (this.el.is('grabbed'))
      {
        this.data.enabled = !this.data.enabled
        this.updateEnabled()
      }
    })

    this._tick = this.tick
    this.tick = AFRAME.utils.throttleTick(this.tick, this.data.throttle, this)
  },
  update(oldData) {
    this.updateEnabled()
  },
  calcFar() {
    return this.tipHeight * this.el.object3D.scale.x
  },
  updateRaycaster: function(far)
  {
    // setAttribute constitutes a memory problem. So just do this part manually
    let data = this.data
    var raycaster = this.raycaster;

    // Set raycaster properties.
    raycaster.far = data.far;
    raycaster.near = data.near;

    // Calculate unit vector for line direction. Can be multiplied via scalar to performantly
    // adjust line length.
    this.unitLineEndVec3.copy(data.origin).add(data.direction).normalize();
  },
  updateDrawTool() {
    let far = this.calcFar()
    this.el.components.raycaster.data.far = far
    this.updateRaycaster.call(this.el.components.raycaster)
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
    this.updateDrawTool()
  },
  updateEnabled() {
    this.tip.setAttribute('visible', this.data.enabled)

    let handDrawTool = this.el.components['hand-draw-tool']
    if (!this.data.enabled && handDrawTool.isDrawing)
    {
      console.log("Ending draw")
      handDrawTool.endDraw()
      handDrawTool.isDrawing = false
    }
    else if (this.data.enabled && this.el.components.raycaster.intersectedEls.length > 0)
    {
      handDrawTool.isDrawing = true
      handDrawTool.startDraw()
    }
  }
})

AFRAME.registerComponent('pencil-broom', {
  init() {
    this.el.classList.add('grab-root')
    this.el.setAttribute('grab-options', "showHand: false")
    for (let j = 0; j < 4; j++)
    {
      for (let i = 0; i < 3; i++)
      {
        let pencil = document.createElement('a-entity')
        pencil.setAttribute('pencil-tool', "")
        pencil.setAttribute('position', `${j * 0.05 + (j % 2) *0.02} 0 ${i * 0.05}`)
        pencil['redirect-grab'] = this.el
        this.el.append(pencil)
        pencil.components['pencil-tool'].calcFar = () => pencil.components['pencil-tool'].tipHeight * this.el.object3D.scale.x
      }
    }
  },
})

AFRAME.registerComponent('spike-ball', {
  init() {
    this.el.classList.add('grab-root')
    this.el.setAttribute('grab-options', "showHand: false")
    for (let i = 0; i < 10; i++)
    {
      let pencil = document.createElement('a-entity')
      pencil.setAttribute('pencil-tool', "")
      pencil.setAttribute('rotation', `${Math.random() * 360} ${Math.random() * 360} ${Math.random() * 360}`)
      pencil['redirect-grab'] = this.el
      this.el.append(pencil)
      pencil.components['pencil-tool'].calcFar = () => pencil.components['pencil-tool'].tipHeight * this.el.object3D.scale.x
    }

    // TODO: Need to make each pencil's far value match the parent scale
  }
})

AFRAME.registerComponent('hammer-tool', {
  schema: {
    throttle: {type: 'int', default: 30},
    scaleTip: {type: 'boolean', default: true},
    pressureTip: {type: 'boolean', default: false},
  },
  init() {
    this.el.classList.add('grab-root')

    let handleHeight = 0.3
    let handleRadius = 0.03
    let handle = document.createElement('a-cylinder')
    handle.setAttribute('radius', handleRadius)
    handle.setAttribute('height', handleHeight)
    handle.setAttribute('material', 'side: double; src: #asset-shelf; metalness: 0.4; roughness: 0.7')
    handle.classList.add('clickable')
    handle.setAttribute('propogate-grab', "")
    this.el.append(handle)

    let headRadius = 0.05
    let headLength = 0.2
    let headHolder = document.createElement('a-entity')
    headHolder.setAttribute('rotation', '0 0 90')
    headHolder.setAttribute('rotation', '0 0 90')
    headHolder.setAttribute('position', `0 ${handleHeight / 2.0} 0`)
    this.el.append(headHolder)
    let head = document.createElement('a-cylinder')
    this.head = head
    head.setAttribute('radius', headRadius)
    head.setAttribute('height', headLength)
    // head.classList.add('clickable')
    head.setAttribute('propogate-grab', "")
    head.setAttribute('material', 'side: double; color: #eee; metalness: 0.9; roughness: 0.4')
    head.setAttribute('raycaster', `objects: .canvas; showLine: true; direction: 0 1 0; origin: 0 0 0; far: ${headLength / 2}`)
    head.setAttribute('hand-draw-tool', "")
    headHolder.append(head)

    let tip = document.createElement('a-sphere')
    tip.setAttribute('radius', 0.01)
    tip.setAttribute('show-current-color', "")
    tip.setAttribute('position', `0 ${headLength / 2} 0`)
    tip.setAttribute('propogate-grab', "")
    head.append(tip)
    this.tip = tip

    this._tick = this.tick
    this.tick = AFRAME.utils.throttleTick(this.tick, this.data.throttle, this)

    head.addEventListener('raycaster-intersection', e => {
      let pct = THREE.Math.mapLinear(this.speed, 0, 0.008, 0, 1)
      console.log("Hit", this.speed, pct)
      // this.updateDrawTool()
      let handDrawTool = head.components['hand-draw-tool']
      handDrawTool.pressure = pct
      // handDrawTool.distanceScale = pct
      handDrawTool.isDrawing = true
      handDrawTool.hasDrawn = false
      handDrawTool.singleShot = true
      handDrawTool.startDraw()
      Sfx.bang(this.el)
      this.el.addState('hitting')
    })

    head.addEventListener('raycaster-intersection-cleared', e => {
      console.log("Hit cleared")
      this.el.removeState('hitting')
    })
  },
  tick(t, dt) {
    if (!this.velocity)
    {
      this.velocity = new THREE.Vector3()
      this.lastPosition = new THREE.Vector3()
      this.position = new THREE.Vector3()
      this.tip.object3D.getWorldPosition(this.lastPosition)
      return
    }

    if (this.el.is("hitting"))
    {
      let handDrawTool = this.head.components['hand-draw-tool']
      if (handDrawTool.hasDrawn)
      {
        handDrawTool.isDrawing = false
        handDrawTool.hasDrawn = false
        handDrawTool.endDraw()
      }
      return
    }

    let {lastPosition, position, velocity} = this
    this.tip.object3D.getWorldPosition(position)
    velocity.subVectors(position, lastPosition)
    this.speed = velocity.length() / dt
    lastPosition.copy(position)
    // console.log(this.speed)
  }
})
