import { PMREMGenerator} from './framework/PMREMGenerator.js'
import {RGBELoader} from './framework/RGBELoader.js'

// Allows setting an HDRI to use as an a-sky background and scene-wide
// environment map
AFRAME.registerComponent('hdri-environment', {
  dependencies: ['material'],
  schema: {
    // Selector for the `a-asset-item` with the src set to the `.hdri` file
    src: {type: 'selector'},

    // Exposure for the hdri
    exposure: {default: 0.724},

    // THREE.js tone mapping constant
    toneMapping: {default: 5},

    // If set, will set the envMap for all selected elements and children with compatible materials
    envMapSelector: {type: 'selectorAll', default: 'a-scene'},

    // If > 0 will set the envMap for all objects with compatible material continuously
    updateEnvMapThrottle: {default: 100},
  },
  update(oldData) {
    if (oldData.src !== this.data.src)
    {
      this.setHDRI()
    }

    if (oldData.updateEnvMapThrottle !== this.data.updateEnvMapThrottle)
    {
      if (this.data.updateEnvMapThrottle <= 0) {
        this.tick = function() {}
      }
      else
      {
        this.tick = AFRAME.utils.throttleTick(this._tick, this.data.updateEnvMapThrottle, this)
      }
    }
  },
  loadRGBE(url) {
    return new Promise((r, e) => {
      new RGBELoader()
  			.setDataType( THREE.UnsignedByteType ) // alt: FloatType, HalfFloatType
  			.load( url , function ( texture, textureData ) {
          r({texture, textureData})
  			} );
      })
  },
  async setHDRI() {
    let {texture} = await this.loadRGBE(this.data.src.getAttribute('src'))
    let renderer = this.el.sceneEl.renderer
    renderer.toneMapping = this.data.toneMapping
    renderer.toneMappingExposure = this.data.exposure
    let wasXREnabled = renderer.xr.enabled
    renderer.xr.enabled = false
    var pmremGenerator = new PMREMGenerator( renderer );
    pmremGenerator.compileEquirectangularShader();

    let skyEl = this.el
    let mesh = skyEl.getObject3D('mesh')
    mesh.material.map = texture
    mesh.material.color.set("#FFFFFF")
    mesh.material.needsUpdate = true

    mesh.scale.x = -1
    mesh.scale.z = -1

    this.hdriTexture = texture
    var envMap = pmremGenerator.fromEquirectangular( texture ).texture;

    this.envMap = envMap
    renderer.xr.enabled = wasXREnabled

    pmremGenerator.dispose()

    this.setEnvMap()
  },
  setEnvMap() {
    if (!this.data.envMapSelector) return
    for (let r of this.data.envMapSelector)
    {
      r.object3D.traverse(o => {
        if (o.material && o.material.type === 'MeshStandardMaterial' && o.material.envMap !== this.envMap)
        {
          o.material.envMap = this.envMap
          o.material.needsUpdate = true
        }
      })
    }
  },
  _tick() {
    this.setEnvMap()
  },
})
