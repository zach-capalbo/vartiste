// Eases the creation of undo functionality
class UndoStack {
  constructor({maxSize = 10} = {}) {
    this.stack = []
    this.maxSize = maxSize
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

    if (this.maxSize < 0)
    {
      this.maxSize = 99999
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
    if (!undoCanvas) {
      this.canvas[idx] = document.createElement('canvas')
      undoCanvas = this.canvas[idx]
    }
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
  push(f, {whenSafe} = {}) {
    if (!this.pushAllowed) return
    this.stack.push(f)
    if (whenSafe) f.whenSafe = whenSafe
    if (this.stack.length > this.maxSize)
    {
      let oldFn = this.stack.splice(0, 1)
      if (oldFn.length && oldFn[0].whenSafe)
      {
        this.block(oldFn[0].whenSafe)
      }
    }
  }
  collect(f) {
    var realStack = this.stack
    var realMaxSize = this.maxSize

    this.stack = []
    this.maxSize = 9999

    try {
      f()
    }
    finally {
      var collectedStack = this.stack
      this.stack = realStack
      this.maxSize = realMaxSize
    }

    collectedStack.reverse()
    this.push(() => {
      for (let ff of collectedStack)
      {
        ff()
      }
    })
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
  clear() {
    this.stack = []
  }
}

const Undo = new UndoStack

export {Undo, UndoStack}
