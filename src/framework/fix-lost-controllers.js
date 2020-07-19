AFRAME.registerSystem('fix-lost-controllers', {
  init() {
    this.el.sceneEl.addEventListener('controllersupdated', () => {
      console.log("Controllers updated", this.el.sceneEl.systems['tracked-controls-webxr'].controllers)
    })
    this.tick = AFRAME.utils.throttleTick(this.tick, 50, this)
  },
  tick() {
    let numControllers = this.el.sceneEl.systems['tracked-controls-webxr'].controllers.length
    if (numControllers == 0 || numControllers == 2) return

    // Check more often if one controller goes to sleep
    this.el.sceneEl.systems['tracked-controls-webxr'].updateControllerList()
  }
})
