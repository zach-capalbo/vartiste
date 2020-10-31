// Eases the creation of undo functionality. You can either use a singleton Undo
// stack by calling methods of `VARTISTE.Undo`, or create a new `UndoStack` for
// individual needs.
//
// This works by pushing a function which undoes an action to the stack. Then
// if needed, `undo()`` can be called to call this undo function. E.g.
//
//    Undo.pushCanvas(myCanvas); // Save the state of the canvas before doing anything
//    myCanvas.getContext('2d').fillRect(0, 0, myCanvas.width, myCanvas.height);
//    displayCanvasToUser(myCanvas);
//    if (userDoesntLikeTheColor())
//    {
//        Undo.undo()
//    }
//
// Or
//
//    Undo.push(() => object.position.x -= 3)
//    object.position.x += 3
//    if (notReallyInAGoodPositionAfterAll(object))
//    {
//      Undo.undo()
//    }
class UndoStack {
  // Creates a new undo stack with a maximum size of `maxSize`. If more undo
  // actions are pushed to the stack, then the oldest ones will fall off the
  // bottom.
  //
  // *Note:* The constructor will create `maxSize` number of canvases to
  // optimize the `pushCanvas` function. If `maxSize` is too big, this can use
  // a lot of memory.
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

  // When set to false, calls to this `UndoStack` will be ignored
  set enabled(value) {
    this._enabled = !!value
    if (!this.enabled)
    {
      this.stack = []
      this.pushAllowed = true
    }
  }

  // Whether this `UndoStack` is accepting undo functions
  get enabled() {
    return this._enabled
  }

  // Clears the undo stack and resizes its undo canvases to `width` x `height`
  clearAndResize(width, height) {
    this.stack = []
    for (let i = 0; i < this.maxSize; ++i)
    {
      this.canvas[i].width = width
      this.canvas[i].height = height
    }
  }

  //
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
