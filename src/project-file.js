import {Layer} from './layer.js'

class ProjectFile {
  static update(obj) {
    if (!('width' in obj)) obj.width = 1024
    if (!('height' in obj)) obj.height = 512
    if (!('layers' in obj)) obj.layers = []
    for (let layer of obj.layers)
    {
      if (!('transform' in layer)) layer.transform = Layer.EmptyTransform()
      if (!('rotation' in layer.transform)) layer.transform.rotation = 0
    }
  }
}

export {ProjectFile}
