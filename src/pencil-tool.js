AFRAME.registerComponent('pencil-tool', {
  schema: {
    throttle: {type: 'int', default: 30}
  },
  init() {
    this.el.classList.add('grab-root')

    let radius = 0.03
    let height = 0.3
    let tipHeight = height * 0.2
    let cylinderHeight = height - tipHeight
    let cylinder = document.createElement('a-cylinder')
    this.height = height
    cylinder.setAttribute('radius', radius)
    cylinder.setAttribute('height', cylinderHeight)
    cylinder.setAttribute('position', `0 ${tipHeight / 2} 0`)
    cylinder.classList.add('clickable')
    cylinder.setAttribute('propogate-grab', "")
    this.el.append(cylinder)

    let tip = document.createElement('a-cone')
    tip.setAttribute('radius-top', radius)
    tip.setAttribute('radius-bottom', 0)
    tip.setAttribute('height', tipHeight)
    tip.setAttribute('position', `0 -${cylinderHeight / 2} 0`)
    tip.setAttribute("show-current-color", "")
    this.el.append(tip)

    this.el.setAttribute('raycaster', `objects: .clickable,.canvas; showLine: false; direction: 0 -1 0; far: ${height / 2}`)

    this.el.addEventListener('raycaster-intersection', e => {
      console.log("Hand draw initialized")
      this.el.components['hand-draw-tool'].pressure = 1.0
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
  tick() {
    this.el.setAttribute('raycaster', {far: this.height / 2 * this.el.object3D.scale.x})
  }
})
