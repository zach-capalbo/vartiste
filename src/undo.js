class UndoStack {
  constructor() {
    this.stack = []
    this.maxSize = 10
  }
  pushCanvas(canvas) {
    let imageData = canvas.getContext('2d').getImageData(0,0,canvas.width, canvas.height)
    this.push(() => {
      canvas.getContext('2d').putImageData(imageData, 0, 0)
    })
  }
  push(f) {
    this.stack.push(f)
    if (this.stack.length > this.maxSize)
    {
      this.stack.splice(0, 1)
    }
  }
  undo() {
    if (this.stack.length === 0) return
    this.stack.pop()()
  }
}

const Undo = new UndoStack

export {Undo}
