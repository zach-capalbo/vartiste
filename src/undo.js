class UndoStack {
  constructor() {
    this.stack = []
    this.maxSize = 10
    this.pushAllowed = true
    this._enabled = true
  }
  set enabled(value) {
    this._enabled = !!value
    if (!this.enabled)
    {
      this.stack = []
      this.pushAllowed = true
    }
  }
  get enabled() {
    return this._enabled
  }
  pushCanvas(canvas) {
    if (!this.enabled) return
    let imageData = canvas.getContext('2d').getImageData(0,0,canvas.width, canvas.height)
    this.push(() => {
      canvas.getContext('2d').putImageData(imageData, 0, 0)
    })
  }
  push(f) {
    if (!this.pushAllowed) return
    this.stack.push(f)
    if (this.stack.length > this.maxSize)
    {
      this.stack.splice(0, 1)
    }
  }
  undo() {
    if (this.stack.length === 0) return
    this.block(this.stack.pop())
  }
  block(f) {
    try {
      this.pushAllowed = false
      f()
      this.pushAllowed = true
    }
    catch (e)
    {
      this.pushAllowed = true
      throw e
    }
  }
}

const Undo = new UndoStack

export {Undo}
