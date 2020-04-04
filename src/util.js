function whenLoadedSingle(entity, fn) {
  if (entity.hasLoaded)
  {
    fn()
  }
  else
  {
    entity.addEventListener('loaded', fn)
  }
}

function whenLoadedAll(entities, fn) {
  let allLoaded = entities.map(() => false)
  for (let i = 0; i < entities.length; ++i)
  {
    let ii = i
    let entity = entities[ii]
    whenLoadedSingle(entity, () => {
      allLoaded[ii] = true
      if (allLoaded.every(t => t)) fn()
    })
  }
}

function awaitLoadingSingle(entity) {
  return new Promise((e,r) => whenLoadedSingle(entity, r))
}

async function awaitLoadingAll(entities) {
  for (let entity of entities)
  {
    await awaitLoadingSingle(entity)
  }
}

const Util = {
  validateSize({width, height}) {
    width = parseInt(width)
    height = parseInt(height)
    if (!(Number.isInteger(width) && width > 0)) {
      console.trace()
      throw new Error(`Invalid composition width ${width}`)
    }
    if (!(Number.isInteger(height) && height > 0)) {
      console.trace()
      throw new Error(`Invalid composition height ${height}`)
    }
    return {width, height}
  },
  whenLoaded(entity, fn) {
    if (Array.isArray(entity) && fn) return whenLoadedAll(entity, fn)
    if (Array.isArray(entity)) return awaitLoadingAll(entity)
    if (fn) return whenLoadedSingle(entity, fn)
    return awaitLoadingSingle(entity)
  },
  applyMatrix(matrix, obj) {
    obj.matrix.copy(matrix)
    matrix.decompose(obj.position, obj.rotation, obj.scale)
  }
}

export {Util}
