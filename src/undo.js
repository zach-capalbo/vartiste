import {Util} from './util.js'
import {Sfx} from './sfx.js'

// Eases the creation of undo functionality. You can either use a singleton Undo
// stack by calling methods of `VARTISTE.Undo`, or create a new `UndoStack` for
// individual needs.
//
// This works by pushing a function which undoes an action to the stack. Then
// if needed, `undo()` can be called to call this undo function. E.g.
//
//```js
//    Undo.pushCanvas(myCanvas); // Save the state of the canvas before doing anything
//    myCanvas.getContext('2d').fillRect(0, 0, myCanvas.width, myCanvas.height);
//    displayCanvasToUser(myCanvas);
//    if (userDoesntLikeTheColor())
//    {
//        Undo.undo()
//    }
//```
//
// Or
//
//```
//    Undo.push(() => object.position.x -= 3)
//    object.position.x += 3
//    if (notReallyInAGoodPositionAfterAll(object))
//    {
//      Undo.undo()
//    }
//```
class UndoStack {
  // Creates a new undo stack with a maximum size of `maxSize`. If more undo
  // actions are pushed to the stack, then the oldest ones will fall off the
  // bottom.
  //
  // *Note:* The constructor will create `maxSize` number of canvases to
  // optimize the `pushCanvas` function. If `maxSize` is too big, this can use
  // a lot of memory.
  constructor({maxSize = 10, isRedo = false} = {}) {
    this.stack = []
    this.isRedo = isRedo
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

  // Adds the current state of `canvas` to the undo stack such that calling undo
  // later will restore it even after other edits.
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
    }, {
      redo: (r) => r.pushCanvas(canvas)
    })
  }

  // Pushes `f` to the undo stack. When `undo()` is called and `f` is at the top
  // of the stack, it will be called. If `f` goes off of the undo stack without
  // being called, (e.g., due to the max undo size), then `whenSafe` will be
  // called if provided.
  pushOpts(f, {whenSafe, redo} = {}) {
    if (!this.pushAllowed) return
    this.stack.push(f)
    if (whenSafe) f.whenSafe = whenSafe

    if (this.redoStack)
    {
      if (!this.isRedo && !this.isRedoing) this.redoStack.clear()
      if (this.symmetricRedo) f.redo = this.symmetricRedo
      if (redo) f.redo = redo
    }

    if (this.stack.length > this.maxSize)
    {
      let oldFn = this.stack.splice(0, 1)
      if (oldFn.length && oldFn[0].whenSafe)
      {
        this.block(oldFn[0].whenSafe)
      }
    }
  }

  push(f, r = {}) {
    console.log("Typeof r", typeof r)
    if (typeof r !== 'function')
    {
      this.pushOpts(f, r);
      return;
    }
    this.pushOpts(f, {redo: (rr) => rr.push(r)})
  }

  pushSymmetric(f) {
    try {
      this.symmetricRedo = (r) => { r.pushSymmetric(f) }
      f(this)
    } finally {
      this.symmetricRedo = null
    }
  }

  // Stores `object3D`'s current matrix, and restores it (including applying it)
  // when `undo` is called.
  pushObjectMatrix(object3D) {
    let matrix = new THREE.Matrix4
    // object3D.updateMatrix()
    matrix.copy(object3D.matrix)
    this.push(() => {
      Util.applyMatrix(matrix, object3D)
    }, {
      redo: (r) => r.pushObjectMatrix(object3D)
    })
  }

  // Executes `f` and collects and `push()` or `pushCanvas` calls while f is
  // running into a single undo operation, such that if `undo()` is called, it
  // will undo all of them at once.
  collect(f, r) {
    if (!this.pushAllowed) {
      return f();
    }

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
    }, r)
  }

  // Removes the next item from the undo stack and executes the undo action. Any
  // attempts to push to the undo stack during the undo operation will be
  // blocked.
  undo() {
    if (this.stack.length === 0) return
    let fn = this.stack.pop()
    try {
      if (this.isRedo) this.redoStack.isRedoing = true
      if (this.redoStack) {
        if (fn.redo)
        {
          fn.redo(this.redoStack)
        }
        else
        {
          this.redoStack.push(this.cantRedo)
        }
      }
      this.block(fn)
    } finally {
      if (this.isRedo) this.redoStack.isRedoing = false
    }
  }

  cantRedo() {
    if (this.isRedo)
    {
      Sfx.cantRedo(Util.el)
    }
  }

  // Executes `f`, while blocking any attempts to push anything to the undo
  // stack.
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

  // Clears the undo stack
  clear() {
    for (let s of this.stack)
    {
      if (s.whenSafe) s.whenSafe()
    }
    this.stack = []
  }
}

const Undo = new UndoStack
Undo.redoStack = new UndoStack({isRedo: true})
Undo.redoStack.redoStack = Undo

export {Undo, UndoStack}
