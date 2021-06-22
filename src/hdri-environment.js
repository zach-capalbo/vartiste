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
    toneMapping: {default: 1},

    // If set, will set the envMap for all selected elements and children with compatible materials
    envMapSelector: {type: 'string', default: 'a-scene'},

    // Intensity of the environement map
    intensity: {default: 1.0},

    // If true, it will replace the skybox mesh's texture, and use the hdri as a skybox
    replaceTexture: {default: true},

    // If > 0 will set the envMap for all objects with compatible material continuously
    updateEnvMapThrottle: {default: 100},
  },
  update(oldData) {
    if (oldData.src !== this.data.src)
    {
      this.setHDRI()
    }

    if (oldData.envMapSelector !== this.data.envMapSelector)
    {
      this.envMapSelectorElements = Array.from(document.querySelectorAll(this.data.envMapSelector))
    }

    this.el.sceneEl.renderer.toneMapping = this.data.toneMapping
    this.el.sceneEl.renderer.toneMappingExposure = this.data.exposure

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

  // Loads an RGBE (.hdr) image from URL, and returns a Promise resolving to a texture
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
    let url = this.data.src.getAttribute('src')
    if (!/^https?:\/\//.test(url))
    {
      url = new URL(url, window.location).toString()
    }
    let {texture} = await this.loadRGBE(url)
    let renderer = this.el.sceneEl.renderer
    renderer.toneMapping = this.data.toneMapping
    renderer.toneMappingExposure = this.data.exposure
    let wasXREnabled = renderer.xr.enabled
    renderer.xr.enabled = false
    let PMREMGeneratorClass = THREE.PMREMGenerator || PMREMGenerator
    var pmremGenerator = new PMREMGeneratorClass( renderer );
    pmremGenerator.compileEquirectangularShader();

    let skyEl = this.el
    let mesh = skyEl.getObject3D('mesh')

    if (this.data.replaceTexture)
    {
      mesh.material.map = texture
      mesh.material.color.set("#FFFFFF")
      mesh.material.needsUpdate = true

      mesh.scale.x = -1
      mesh.scale.z = -1
    }

    this.hdriTexture = texture
    var envMap = pmremGenerator.fromEquirectangular( texture ).texture;

    this.envMap = envMap
    renderer.xr.enabled = wasXREnabled

    pmremGenerator.dispose()

    this.setEnvMap()
  },
  setEnvMap() {
    if (!this.envMapSelectorElements) return
    for (let r of this.envMapSelectorElements)
    {
      r.object3D.traverseVisible(o => {
        if (o.material && o.material.type === 'MeshStandardMaterial' &&
          (o.material.envMap !== this.envMap || o.material.envMapIntensity !== this.data.envMapIntensity))
        {
          o.material.envMap = this.envMap
          o.material.envMapIntensity = this.data.intensity
          o.material.needsUpdate = true
        }
      })
    }
  },
  _tick() {
    this.setEnvMap()
  },
})
