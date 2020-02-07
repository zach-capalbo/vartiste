import {Layer} from './layer.js'
import {base64ArrayBuffer} from './framework/base64ArrayBuffer.js'
import {base64ToBufferAsync} from './framework/base64ArrayBufferAsync.js'
const FILE_VERSION = 2
class ProjectFile {
  static update(obj) {
    if (!('_fileVersion') in obj) obj._fileVersion = 0
    if (!('width' in obj)) obj.width = 1024
    if (!('height' in obj)) obj.height = 512
    if (!('layers' in obj)) obj.layers = []
    if (!('projectName' in obj)) obj.projectName = 'project'
    if (!('shader' in obj)) obj.shader = 'flat'
    if (!('frameRate' in obj)) obj.frameRate = 10
    for (let layer of obj.layers)
    {
      if (!('transform' in layer)) layer.transform = Layer.EmptyTransform()
      if (!('rotation' in layer.transform)) layer.transform.rotation = 0
      if (obj._fileVersion < 1)
      {
        if (layer.mode === 'bumpMap')
        {
          console.log("Updating old bump map")
          layer.opacity = Math.pow(layer.opacity, 1/2.2)
        }
      }
    }
    for (let i in obj.canvases)
    {
      if (obj._fileVersion < 2)
      {
        obj.canvases[i] = [obj.canvases[i]]
      }
    }
  }

  static async load(obj, {compositor}) {
    ProjectFile.update(obj)
    let settings = document.getElementsByTagName('a-scene')[0].systems['settings-system']
    settings.setProjectName(obj.projectName)

    await compositor.load(obj)
    compositor.el.setAttribute('material', {shader: obj.shader})

    if (obj.glb)
    {
      let loader = new THREE.GLTFLoader()
      let buffer = await base64ToBufferAsync(obj.glb)
      let model = await new Promise((r, e) => loader.parse(buffer, "", r, e))

      settings.addModelView(model)
    }
  }

  async _save() {
    let obj = {}
    obj._fileVersion = FILE_VERSION
    obj.projectName = document.querySelector('a-scene').systems['settings-system'].projectName
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
      frameRate: compositor.data.frameRate,
      canvases: layers.map(l => l.frames.map(f => f.toDataURL()))
    }
  }
}

export {ProjectFile}
