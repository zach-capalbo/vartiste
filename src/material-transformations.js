function bumpCanvasToNormalCanvas(bumpCanvas, normalCanvas) {
  let bumpCtx = bumpCanvas.getContext('2d')
  let bumpData = bumpCtx.getImageData(0, 0, bumpCanvas.width, bumpCanvas.height)

  let sampleBump = (i,j) => bumpData.data[4*(j * bumpCanvas.width + i) + 0] / 255 * bumpData.data[4*(j * bumpCanvas.width + i) + 3] / 255.0

  if (typeof normalCanvas === 'undefined') {
    normalCanvas = document.createElement('canvas')
    normalCanvas.width = bumpCanvas.width
    normalCanvas.height = bumpCanvas.height
  }

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

function putRoughnessInMetal(roughness, metalness)
{
  if (!metalness)
  {
    metalness = document.createElement('canvas')
    metalness.width = roughness.width
    metalness.height = roughness.height
    let metalCtx = metalness.getContext('2d')
    metalCtx.fillStyle = "#000"
    metalCtx.fillRect(0,0, metalness.width, metalness.height)
  }
  if (metalness.width !== roughness.width || metalness.height !== roughness.height)
  {
    console.warn("Metalness and roughness are not same dimensions")
  }

  let roughCtx = roughness.getContext('2d')
  let metalCtx = metalness.getContext('2d')

  let roughData = roughCtx.getImageData(0,0, roughness.width, roughness.height)
  let metalData = metalCtx.getImageData(0,0, roughness.width, roughness.height)

  for (let j = 0; j < roughness.height; ++j)
  {
    for (let i = 0; i < roughness.width; ++i)
    {
      metalData.data[4*(j * roughness.width + i) + 1] = roughData.data[4*(j * roughness.width + i) + 1]
      // metalData.data[4*(j * roughness.width + i) + 2] = v.z * 255
      metalData.data[4*(j * roughness.width + i) + 3]  = 255
    }
  }

  metalCtx.putImageData(metalData, 0, 0)

  return metalness
}

function checkTransparency(material) {
  let canvas = material.map.image
  let ctx = canvas.getContext('2d')
  let imgData = ctx.getImageData(0, 0, canvas.width, canvas.height)

  const ALPHA_CUTOFF = 245

  for (let j = 0; j < canvas.height; ++j)
  {
    for (let i = 0; i < canvas.width; ++i)
    {
      if (imgData.data[4*(j * canvas.width + i) + 3]  < ALPHA_CUTOFF)
      {
        console.log("Found transparent pixel", imgData.data[4*(j * canvas.width + i) + 3])
        return
      }
    }
  }
  material.transparent = false
}

function prepareModelForExport(model, material) {
  console.log("Preparing", model, material)
  if (material.bumpMap) {
    console.log("Bumping into normal")
    if (material.normalMap) console.warn("Ignoring existing normal map")
    material.normalMap = new THREE.Texture()
    material.normalMap.image = bumpCanvasToNormalCanvas(material.bumpMap.image)
  }

  if (material.roughnessMap) {
    console.log("Combining roughness into metalness")
    if (!material.metalnessMap) material.metalnessMap = new THREE.Texture()
    material.metalnessMap.image = putRoughnessInMetal(material.roughnessMap.image, material.metalnessMap.image)
    material.metalnessMap.needsUpdate = true
    material.roughnessMap = material.metalnessMap
    material.needsUpdate = true
  }
  else if (material.metalnessMap)
  {
    let roughCanvas = document.createElement('canvas')
    roughCanvas.width = material.metalnessMap.image.width
    roughCanvas.height = material.metalnessMap.image.height
    let roughCtx = roughCanvas.getContext('2d')
    roughCtx.fillStyle = "#000"
    roughCtx.fillRect(0,0,roughCanvas.width,roughCanvas.height)
    putRoughnessInMetal(roughCanvas, material.metalnessMap.image)
    material.roughnessMap = material.metalnessMap
    material.needsUpdate = true
  }
  checkTransparency(material)
}

export {prepareModelForExport}
