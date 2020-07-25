import Color from 'color'
import { PMREMGenerator} from './framework/PMREMGenerator.js'
import {RGBELoader} from './framework/RGBELoader.js'

const [
  STATE_COLOR,
  STATE_HDRI,
  STATE_SKYBOX,
  STATE_PRESET
] = [
  "STATE_COLOR",
  "STATE_HDRI",
  "STATE_SKYBOX",
  "STATE_PRESET"
]

AFRAME.registerSystem('environment-manager', {
  init() {
    this.state = STATE_COLOR
    this.tick = AFRAME.utils.throttleTick(this.tick, 100, this)
  },
  switchState(newState) {
    if (newState == this.state) return
    console.log(`Switching environment from ${this.state} to ${newState}`)

    this.substate = ""

    let skyEl = document.getElementsByTagName('a-sky')[0]

    if (this.uninstallState) {
      this.uninstallState()
      this.uninstallState = undefined
    }
    else {
      console.warn(`Current state ${this.state} has no uninstall`)
    }
    this.state = newState;
  },
  canInstallSkybox() {
    return this.state !== STATE_HDRI
  },
  installSkybox(skybox, level) {
    let skyEl = document.getElementsByTagName('a-sky')[0]
    this.switchState(STATE_SKYBOX)

    if (typeof skybox === 'string')
    {
      skyEl.setAttribute('src', skybox)
      return
    }
    if (!skyEl.getObject3D('mesh').material.map || skyEl.getObject3D('mesh').material.map.image != skybox)
    {
      console.log("Setting skybox")
      if (!skyEl.getObject3D('mesh').material.map)
      {
        skyEl.getObject3D('mesh').material.map = new THREE.Texture()
      }

      skyEl.getObject3D('mesh').material.map.image = skybox
      skyEl.getObject3D('mesh').material.map.needsUpdate = true
      skyEl.getObject3D('mesh').material.needsUpdate = true
    }

    if (level !== this.skyboxLevel)
    {
      skyEl.setAttribute('color', Color.hsl(0,0, level * 100).rgb().string())
      this.skyboxLevel = level
    }

    this.substate = ""
  },
  installPresetEnvironment(preset = "starry") {
    this.switchState(STATE_PRESET)
    let envEl = document.querySelector('*[environment]')

    if (!envEl) {
      envEl = document.createElement('a-entity')
      document.getElementsByTagName('a-scene')[0].append(envEl)
      envEl.setAttribute('position', '0 -7 0')
    }

    envEl.setAttribute('environment', {preset})
  },
  removePresetEnvironment() {
    for (let envEl of document.querySelectorAll('*[environment]'))
    {
      envEl.parentEl.removeChild(envEl)
    }

    for (let sky of document.querySelectorAll('a-sky'))
    {
      if (sky)
      {
        sky.parentEl.removeChild(sky)
      }
    }

    let sky = document.createElement('a-sky')
    sky.setAttribute('color', "#333")
    document.getElementsByTagName('a-scene')[0].append(sky)
  },
  toggle() {
    let envEl = document.querySelector('*[environment]')
    if (!envEl || !envEl.getAttribute('visible'))
    {
      this.installPresetEnvironment()
      return
    }

    this.removePresetEnvironment()
  },
  setSkyBrightness(exposure) {
    let skyEl = document.getElementsByTagName('a-sky')[0]
    skyEl.getObject3D('mesh').material.color.r = exposure
    skyEl.getObject3D('mesh').material.color.g = exposure
    skyEl.getObject3D('mesh').material.color.b = exposure
  },
  installHDREnvironment(texture) {
    this.switchState(STATE_HDRI)
    let renderer = AFRAME.scenes[0].renderer
    let wasXREnabled = renderer.xr.enabled
    renderer.xr.enabled = false
    var pmremGenerator = new PMREMGenerator( renderer );
    pmremGenerator.compileEquirectangularShader();

    let scene = this.el.object3D

    let skyEl = document.getElementsByTagName('a-sky')[0]
    skyEl.getObject3D('mesh').material.map = texture
    // skyEl.getObject3D('mesh').material.map.needsUpdate = true
    skyEl.getObject3D('mesh').material.needsUpdate = true

    skyEl.getObject3D('mesh').scale.x = -1
    skyEl.getObject3D('mesh').scale.z = -1

    this.setSkyBrightness(0.7)

    this.hdriTexture = texture

    var envMap = pmremGenerator.fromEquirectangular( texture ).texture;

    // When new three.js is integrated into AFRAME, we can do something like:
    // scene.background = texture;
    // scene.environment = envMap;

    var originalLights = []
    document.querySelectorAll('*[light]').forEach(l => {
      originalLights.push([l, l.components.light.data.intensity])
      l.setAttribute('light', {intensity: 0})
    })

    this.envMap = envMap
    renderer.xr.enabled = wasXREnabled

    pmremGenerator.dispose()

    this.substate = ''

    if (this.uninstallState) return

    this.uninstallState = () => {
      this.setToneMapping(THREE.LinearToneMapping)
      this.setSkyBrightness(1.0)
      this.el.renderer.toneMappingExposure = 1.0
      skyEl.getObject3D('mesh').material.map = null
      skyEl.getObject3D('mesh').scale.x = 1
      skyEl.getObject3D('mesh').scale.z = 1
      skyEl.getObject3D('mesh').material.needsUpdate = true
      for (let [l, i] of originalLights) {
        l.setAttribute('light', {intensity: i})
      }

      this.el.object3D.traverse(o => {
        if (o.material && this.shouldTouchMaterial(o.material) && o.material.envMap == this.envMap)
        {
          o.material.envMap = null
          o.material.needsUpdate = true
        }
      })

      this.hdriTexture = undefined
    }
  },
  setToneMapping(toneMapping) {
    this.el.renderer.toneMapping = toneMapping
    document.querySelectorAll('#world-root,#artist-root,a-sky').forEach(r => { r.object3D.traverse(o => {
      if (o.visible && o.material && (this.shouldTouchMaterial(o.material)))
      {
        o.material.needsUpdate = true
      }
    })})
  },
  async usePresetHDRI() {
    this.switchState(STATE_HDRI)
    await new Promise( (r,e) => {
  		new RGBELoader()
  			.setDataType( THREE.UnsignedByteType ) // alt: FloatType, HalfFloatType
  			.load( new URL(require('./assets/colorful_studio_1k.hdr').toString(), window.location).toString() , ( texture, textureData ) => {
          this.installHDREnvironment(texture)
  				r()
  			} );
    })

    document.querySelector('a-sky').setAttribute('material', {src: "#asset-colorful_studio"})
    this.setToneMapping(5)
    this.setSkyBrightness(0.98)
    this.el.renderer.toneMappingExposure = 0.724
    this.substate = 'preset-hdri'
  },
  reset() {
    this.switchState(STATE_COLOR)
    let skyEl = document.getElementsByTagName('a-sky')[0]
    skyEl.getObject3D('mesh').material.color.r = 0.033
    skyEl.getObject3D('mesh').material.color.g = 0.033
    skyEl.getObject3D('mesh').material.color.b = 0.033
  },

  shouldTouchMaterial(material) {
    return material.type === 'MeshStandardMaterial'
  },

  installMatcap() {
    let material = new THREE.MeshMatcapMaterial({skinning: true})
    material.matcap = new THREE.Texture()
    material.matcap.image = document.querySelector('#asset-matcap')
    material.matcap.needsUpdate = true

    material.map = new THREE.Texture({image: Compositor.material.map.image})
    material.needsUpdate = true
    Compositor.el.getObject3D('mesh').material = material
    Compositor.mesh.material = material
  },

  tick(t,dt) {
    if (this.state === STATE_HDRI)
    {
      document.querySelectorAll('#world-root,#artist-root').forEach(r => { r.object3D.traverse(o => {
        if (o.visible && o.material && (this.shouldTouchMaterial(o.material)) && o.material.envMap !== this.envMap)
        {
          o.material.envMap = this.envMap
          o.material.needsUpdate = true
        }
      })})
    }
  }
})

AFRAME.registerComponent('environment-manager', {
  events: {
    brightnesschanged: function (e) {
      let exposure = e.detail.brightness

      if (e.target.classList.contains("bg-exposure"))
      {
        let skyEl = document.getElementsByTagName('a-sky')[0]
        skyEl.getObject3D('mesh').material.color.r = exposure
        skyEl.getObject3D('mesh').material.color.g = exposure
        skyEl.getObject3D('mesh').material.color.b = exposure
      }

      if (e.target.classList.contains("renderer-exposure"))
      {
        this.el.sceneEl.renderer.toneMappingExposure = exposure
      }
    },
    click: function (e) {
      if (e.target.hasAttribute("click-action"))
      {
        let action = e.target.getAttribute('click-action')

        if (action in this)
        {
          this[action](e)
        }
        else if (action in this.system)
        {
          this.system[action]()
        }
      }
    }
  },
  init() {},
  toneMapping() {
    this.system.setToneMapping((this.el.sceneEl.renderer.toneMapping + 1) % 6)
  }
})
