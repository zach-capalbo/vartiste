import Color from 'color'
import { PMREMGenerator} from './framework/PMREMGenerator.js'
import {RGBELoader} from './framework/RGBELoader.js'

AFRAME.registerSystem('environment-manager', {
  installSkybox(skybox, level) {
    // if (typeof skybox === 'undefined') skybox = require('./assets/skybox.jpg')

    let skyEl = document.getElementsByTagName('a-sky')[0]

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
  },
  installPresetEnvironment(preset = "starry") {
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
  installHDREnvironment(texture) {
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

    let exposure = 0.7
    skyEl.getObject3D('mesh').material.color.r = exposure
    skyEl.getObject3D('mesh').material.color.g = exposure
    skyEl.getObject3D('mesh').material.color.b = exposure


    var envMap = pmremGenerator.fromEquirectangular( texture ).texture;

    // When new three.js is integrated into AFRAME, we can do something like:
    // scene.background = texture;
    // scene.environment = envMap;

    document.querySelectorAll('*[light]').forEach(l => l.setAttribute('light', {intensity: 0}))

    this.envMap = envMap
    renderer.xr.enabled = wasXREnabled
  },
  setToneMapping(toneMapping) {
    this.el.renderer.toneMapping = toneMapping
    document.querySelectorAll('#world-root,#artist-root,a-sky').forEach(r => { r.object3D.traverse(o => {
      if (o.visible && o.material && (o.material.type === 'MeshStandardMaterial'))
      {
        o.material.needsUpdate = true
      }
    })})
  },
  async usePresetHDRI() {
    console.log("Using" , require('./assets/colorful_studio_1k.hdr'))
    await new Promise( (r,e) => {
  		new RGBELoader()
  			.setDataType( THREE.UnsignedByteType ) // alt: FloatType, HalfFloatType
  			.load( "/" + require('./assets/colorful_studio_1k.hdr').toString() , ( texture, textureData ) => {
          this.installHDREnvironment(texture)
  				r()
  			} );
    })

    document.querySelector('a-sky').setAttribute('material', {src: "#asset-colorful_studio"})
    this.setToneMapping(5)

    let skyEl = document.getElementsByTagName('a-sky')[0]
    let exposure = 0.98
    skyEl.getObject3D('mesh').material.color.r = exposure
    skyEl.getObject3D('mesh').material.color.g = exposure
    skyEl.getObject3D('mesh').material.color.b = exposure

    this.el.renderer.toneMappingExposure = 0.724

  },

  tick(t,dt) {
    document.querySelectorAll('#world-root,#artist-root').forEach(r => { r.object3D.traverse(o => {
      if (o.visible && o.material && (o.material.type === 'MeshStandardMaterial') && o.material.envMap !== this.envMap)
      {
        o.material.envMap = this.envMap
        o.material.needsUpdate = true
      }
    })})
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
