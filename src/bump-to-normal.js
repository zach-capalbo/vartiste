function bumpCanvasToNormalCanvas(bumpCanvas, normalCanvas) {
  let bumpCtx = bumpCanvas.getContext('2d')
  let bumpData = bumpCtx.getImageData(0, 0, bumpCanvas.width, bumpCanvas.height)

  let sampleBump = (i,j) => bumpData.data[4*(j * bumpCanvas.width + i) + 0] / 255 * bumpData.data[4*(j * bumpCanvas.width + i) + 3] / 255.0

  if (typeof normalCanvas === 'undefined') normalCanvas = document.createElement('canvas')

  let normalCtx = normalCanvas.getContext('2d')
  let normalData = normalCtx.getImageData(0, 0, normalCanvas.width, normalCanvas.height)

  let setNormal = (x,y,v) => {
    let i = Math.floor(x / bumpCanvas.width * normalCanvas.width)
    let j = Math.floor(y / bumpCanvas.height * normalCanvas.height)
    normalData.data[4*(j * normalCanvas.width + i) + 0] = v.x * 255
    normalData.data[4*(j * normalCanvas.width + i) + 1] = v.y * 255
    normalData.data[4*(j * normalCanvas.width + i) + 2] = v.z * 255
    normalData.data[4*(j * normalCanvas.width + i) + 3]  = 255
  }

  let vec = new THREE.Vector3()

  let scale = 1.0/10.0

  for (let x = 0; x < bumpCanvas.width; ++x)
  {
    for (let y = 0; y < bumpCanvas.height; ++y)
    {
      let height_pu = sampleBump(x + 1, y)
      let height_mu = sampleBump(x - 1, y)
      let height_pv = sampleBump(x, y + 1)
      let height_mv = sampleBump(x, y - 1)
      let du = height_mu - height_pu
      let dv = height_mv - height_pv
      vec.set(du, dv, scale).normalize()
      setNormal(x,y,vec)
    }
  }

  normalCtx.putImageData(normalData, 0, 0)

  return normalCanvas
}

export {bumpCanvasToNormalCanvas}
