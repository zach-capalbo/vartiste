import {Layer} from './layer.js'

const FILE_VERSION = 1
class ProjectFile {
  static update(obj) {
    if (!('_fileVersion') in obj) obj._fileVersion = 0
    if (!('width' in obj)) obj.width = 1024
    if (!('height' in obj)) obj.height = 512
    if (!('layers' in obj)) obj.layers = []
    for (let layer of obj.layers)
    {
      if (!('transform' in layer)) layer.transform = Layer.EmptyTransform()
      if (!('rotation' in layer.transform)) layer.transform.rotation = 0
      if (obj._fileVersion < 1)
      {
        if (layer.mode === 'bumpMap')
        {
          layer.opacity = Math.pow(layer.opacity, 1/2.2)
        }
      }
    }
  }

  static save(obj) {
    obj._fileVersion = FILE_VERSION
  }
}

export {ProjectFile}
