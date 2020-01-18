import {Layer} from './layer.js'
import {base64ArrayBuffer} from './framework/base64ArrayBuffer.js'
import {base64ToBufferAsync} from './framework/base64ArrayBufferAsync.js'
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
    if (!('shader' in obj)) obj.shader = 'flat'
  }

  static async load(obj, {compositor}) {
    ProjectFile.update(obj)
    await compositor.load(obj)
    compositor.el.setAttribute('material', {shader: obj.shader})

    if (obj.glb)
    {
      let loader = new THREE.GLTFLoader()
      let buffer = await base64ToBufferAsync(obj.glb)
      let model = await new Promise((r, e) => loader.parse(buffer, "", r, e))

      document.getElementsByTagName('a-scene')[0].systems['settings-system'].addModelView(model)
    }
  }

  async _save() {
    let obj = {}
    obj._fileVersion = FILE_VERSION
    Object.assign(obj, this.saveCompositor())

    let glbMesh = document.getElementById('composition-view').getObject3D('mesh')
    if (glbMesh)
    {
      let material = new THREE.MeshBasicMaterial()
      glbMesh.traverse(o => {
        if (o.type == "Mesh") { o.material = material}
      })

      let exporter = new THREE.GLTFExporter()
      let glb = await new Promise((r, e) => {
        exporter.parse(glbMesh, r, {binary: true})
      })
      obj.glb = base64ArrayBuffer(glb)
    }

    return obj
  }

  constructor({compositor}) {
    this.compositor = compositor
  }

  static async save(...args) {
    return await (new ProjectFile(...args))._save()
  }

  saveCompositor() {
    let {compositor} = this
    let {layers} = compositor

    return {
      layers,
      width: compositor.width,
      height: compositor.height,
      shader: compositor.el.getAttribute('material').shader,
      canvases: layers.map(l => l.canvas.toDataURL())
    }
  }
}

export {ProjectFile}