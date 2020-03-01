class UndoStack {
  constructor() {
    this.stack = []
    this.maxSize = 10
    this.pushAllowed = true
    this._enabled = true

    this.canvasIndex = 0
    this.canvas = []
    for (let i = 0; i < this.maxSize; ++i)
    {
      this.canvas[i] = document.createElement('canvas')
      this.canvas[i].width = 2048
      this.canvas[i].height = 2048
    }
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
  clearAndResize(width, height) {
    this.stack = []
    for (let i = 0; i < this.maxSize; ++i)
    {
      this.canvas[i].width = width
      this.canvas[i].height = height
    }
  }
  pushCanvas(canvas) {
    if (!this.enabled) return
    // let imageData = canvas.getContext('2d').getImageData(0,0,canvas.width, canvas.height)
    let idx = this.canvasIndex
    this.canvasIndex = (this.canvasIndex + 1) % this.maxSize
    let undoCanvas = this.canvas[idx]
    if (undoCanvas.width !== canvas.width || undoCanvas.height !== canvas.height)
    {
      console.log("Need to resize undo canvas")
      undoCanvas.width = canvas.width
      undoCanvas.height = canvas.height
    }
    let ctx = undoCanvas.getContext('2d')
    ctx.globalCompositeOperation = 'copy'
    ctx.drawImage(canvas, 0, 0)
    this.push(() => {
      let undoCtx = canvas.getContext('2d')
      let operation = undoCtx.globalCompositeOperation
      undoCtx.globalCompositeOperation = 'copy'
      undoCtx.drawImage(undoCanvas, 0, 0)
      undoCtx.globalCompositeOperation = operation
      if (canvas.touch) canvas.touch()
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
