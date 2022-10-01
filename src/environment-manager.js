import Color from 'color'
// import { PMREMGenerator} from './framework/PMREMGenerator.js'
import {RGBELoader} from './framework/RGBELoader.js'
import {Util} from './util.js'
import {Pool} from './pool.js'
import {POST_MANIPULATION_PRIORITY} from './manipulator.js'
import {GroundProjectedEnv} from './framework/GroundProjectedEnv.js'

const [
  STATE_COLOR,
  STATE_HDRI,
  STATE_SKYBOX,
  STATE_PRESET,
  STATE_ENVIROPACK,
] = [
  "STATE_COLOR",
  "STATE_HDRI",
  "STATE_SKYBOX",
  "STATE_PRESET",
  "STATE_ENVIROPACK",
]

Util.registerComponentSystem('environment-manager', {
  schema: {
    rendererExposure: {default: 0.724},
    bgExposure: {default: 1.0},
    envMapIntensity: {default: 1.0},
    initialState: {default: STATE_COLOR},
    toneMapping: {default: 'NoToneMapping', oneOf: ['NoToneMapping', 'LinearToneMapping', 'ReinhardToneMapping', 'CineonToneMapping', 'ACESFilmicToneMapping']},
    transparencyMode: {default: 'depthBlend', oneOf: ['depthBlend', 'blend', 'hashed']},
    alphaTest: {default: 0.01},
    groundProject: {default: true},
    groundProjectScale: {default: 100},
  },
  events: {
    anglechanged: function (e) {
      let exposure = e.detail.value

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
    updatemateriallighting: function(e) {
      this.updateMaterials();
    }
  },
  init() {
    this.state = STATE_COLOR
    this.tick = AFRAME.utils.throttleTick(this.tick, 100, this)
    this.elementsToCheck = Array.from(document.querySelectorAll('#world-root,#artist-root'))
    this.canvasRoot = this.el.querySelector('#canvas-root')
    this.hasSwitched = false
    Util.whenLoaded(this.el, () => {
      this.usePresetHDRI({initial: true})

      // if (this.data.initialState !== STATE_PRESET)
      // {
      //   this.useEnviropack("tankfarm")
      // }
    })
  },
  update(oldData) {
    if (this.data.toneMapping !== oldData.toneMapping)
    {
      this.setToneMapping(THREE[this.data.toneMapping])
    }
    this.el.sceneEl.renderer.toneMappingExposure = this.data.rendererExposure
  },
  switchState(newState, updateSwitched = true) {
    if (updateSwitched) { this.hasSwitched = true; }
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
    return this.state !== STATE_HDRI && this.state !== STATE_ENVIROPACK
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
  installGroundProjectedEnvironment(texture, switchState = true) {
    if (switchState) { this.switchState(STATE_HDRI) }

    let skyEl = document.getElementsByTagName('a-sky')[0]
    skyEl.removeObject3D('mesh')
    let ground = new GroundProjectedEnv(texture)
    ground.scale.setScalar(this.data.groundProjectScale)
    ground.material.color = new THREE.Color()
    skyEl.setObject3D('mesh', ground)

    this.setSkyBrightness(0.7)

    this.hdriTexture = texture

    // this.el.sceneEl.object3D.background = texture;
    texture.mapping = THREE.EquirectangularReflectionMapping;
    this.el.sceneEl.object3D.environment = texture;

    var originalLights = []
    document.querySelectorAll('*[light]').forEach(l => {
      originalLights.push([l, l.components.light.data.intensity])
      l.setAttribute('light', {intensity: 0})
    })

    this.envMap = texture
    this.substate = 'ground'

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
  installHDREnvironment(texture, switchState = true) {
    if (this.data.groundProject)
    {
      return this.installGroundProjectedEnvironment(texture, switchState);
    }
    
    if (switchState) { this.switchState(STATE_HDRI) }

    let renderer = AFRAME.scenes[0].renderer
    let wasXREnabled = renderer.xr.enabled
    renderer.xr.enabled = false
    var pmremGenerator = new THREE.PMREMGenerator( renderer );
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
    envMap.mapping = THREE.CubeUVReflectionMapping

    // When new three.js is integrated into AFRAME, we can do something like:
    scene.background = texture;
    scene.environment = envMap;

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
      if (o.visible && o.material && (o.material.isMeshStandardMaterial || o.material.type === 'MeshBasicMaterial'))
      {
        o.material.needsUpdate = true
      }
    })})
    // document.querySelectorAll('a-sky').forEach(el => {
    //   let m = el.getObject3D('mesh').material;
    //   m.needsUpdate = true
    // })
    this.el.sceneEl.emit('tonemappingchanged', toneMapping)

    if (THREE[this.data.toneMapping] !== toneMapping)
    {
      this.data.toneMapping = this.schema.toneMapping.oneOf.find(o => THREE[o] === toneMapping)
      this.el.emit('componentchanged', {name: 'environment-manager'})
    }
  },
  async usePresetHDRI({initial = false} = {}) {
    this.switchState(STATE_HDRI, !initial)
    await new Promise( (r,e) => {
  		new RGBELoader()
  			.setDataType( THREE.HalfFloatType ) // alt: FloatType, HalfFloatType
  			.load( new URL(require('./assets/colorful_studio_1k.hdr').toString(), window.location).toString() , ( texture, textureData ) => {
          if (!(initial && this.hasSwitched))
          {
            console.log("Loaded studio", initial, this.hasSwitched)
            this.installHDREnvironment(texture, false)
          }
  				r()
  			} );
    })

    if (initial && this.hasSwitched)
    {
      console.log("Not finishing preset", initial, this.hasSwitched)
      return;
    }

    let skyEl = document.querySelector('a-sky');
    skyEl.setAttribute('material', {src: ""})
    skyEl.setAttribute('material', {src: "#asset-colorful_studio"})
    
    if (this.data.groundProject)
    {
      let imageTexture = await new THREE.TextureLoader().loadAsync(document.querySelector("#asset-colorful_studio").src)
      imageTexture.mapping = THREE.EquirectangularReflectionMapping;
      imageTexture.encoding = THREE.sRGBEncoding
      skyEl.removeObject3D('mesh')
      let g = new GroundProjectedEnv(imageTexture)
      g.material.color = new THREE.Color()
      g.scale.setScalar(this.data.groundProjectScale)
      skyEl.setObject3D('mesh', g)
    }

    this.setToneMapping(initial ? THREE.NoToneMapping : THREE.LinearToneMapping)
    this.setSkyBrightness(0.98)
    this.el.renderer.toneMappingExposure = 0.724
    this.substate = 'preset-hdri'
  },
  useEnviropack(pack) {
    this.switchState(STATE_ENVIROPACK)
    this.substate = pack;
    var originalLights = []
    document.querySelectorAll('*[light]').forEach(l => {
      originalLights.push([l, l.components.light.data.intensity])
      l.setAttribute('light', {intensity: 0})
    })
    document.querySelector('a-sky').setAttribute('enviropack', 'preset', pack)
    this.uninstallState = () => {
      document.querySelector('a-sky').removeAttribute('enviropack')
      for (let [l, i] of originalLights) {
        l.setAttribute('light', {intensity: i})
      }
    };
  },
  reset() {
    this.switchState(STATE_COLOR)
    let skyEl = document.getElementsByTagName('a-sky')[0]
    skyEl.getObject3D('mesh').material.color.r = 0.033
    skyEl.getObject3D('mesh').material.color.g = 0.033
    skyEl.getObject3D('mesh').material.color.b = 0.033
  },

  shouldTouchMaterial(material) {
    return material.isMeshStandardMaterial
  },

  installMatcap() {
    Compositor.el.setAttribute('material', 'shader', 'matcap')
  },
  installPBMatcap() {
    Compositor.el.setAttribute('material', 'shader', 'pbmatcap')
  },
  use3DShading() {
    Compositor.el.setAttribute('material', 'shader', 'standard')
  },
  useFlatShading() {
    Compositor.el.setAttribute('material', 'shader', 'flat')
  },

  setBackgroundColor(color) {
    this.switchState(STATE_COLOR)
    if (color === undefined) color = this.el.sceneEl.systems['paint-system'].data.color
    document.querySelector('a-sky').setAttribute('material', 'color', color)
  },
  toneMapping() {
    this.setToneMapping((this.el.sceneEl.renderer.toneMapping + 1) % 6)
  },
  updateMaterials() {
    return;
    if (this.state === STATE_HDRI)
    {
      for (let r of this.elementsToCheck)
      {
        r.object3D.traverseVisible(o => {
          if (o.visible && o.material && (this.shouldTouchMaterial(o.material)))
          {
            if (o.material.envMap !== this.envMap || o.material.envMapIntensity !== this.data.envMapIntensity)
            {
              o.material.envMap = this.envMap
              o.material.needsUpdate = true
              o.material.envMapIntensity = this.data.envMapIntensity
            }
          }
          if (o.visible && o.material && o.material.transparent && o.material.alphaTest !== this.data.alphaTest)
          {
            o.material.alphaTest = this.data.alphaTest
            o.material.needsUpdate = true
          }
        })
      }
    }
  },

  tick(t,dt) {
    this.updateMaterials()
  }
})

AFRAME.registerSystem('light-tool', {
  activateShadow() {
    this.el.sceneEl.setAttribute('shadow', 'enabled: true')
  },
  tick() {
    if (!this.el.sceneEl.systems.shadow.data.enabled) return
    for (let m of Compositor.nonCanvasMeshes) {
      m.isSkinnedMesh = m.isSkinnedMesh && m.material.skinning
    }
  }
})

AFRAME.registerComponent('light-tool', {
  dependencies: ['six-dof-tool', 'grab-activate'],
  events: {
    activate: function() {
      this.system.activateShadow()
      let light = document.createElement('a-entity')
      this.el.append(light)
      light.setAttribute('light', 'type: spot; intensity: 3; castShadow: true; shadowCameraVisible: false; shadowCameraNear: 0.001; shadowMapWidth: 1024; shadowMapHeight: 1024')
      light.setAttribute('fix-light-shadow', '')
      this.light = light

      let intensity = document.createElement('a-entity')
      this.el.append(intensity)
      intensity.setAttribute('lever', {valueRange: '0 10', initialValue: 3, target: light, component: 'light', property: 'intensity', axis: 'y'})
      intensity.setAttribute('position', '0.265 0 0.5')
      intensity.setAttribute('rotation', '0 90 0')

      let buttonColor = 'white'
      if (this.el.hasAttribute('light-tool-light'))
      {
        let attr = AFRAME.utils.styleParser.parse(this.el.getAttribute('light-tool-light'))
        light.setAttribute('light', attr)
        if (attr.color) buttonColor = attr.color;
      }

      let colorButton = document.createElement('a-entity')
      this.el.append(colorButton)
      colorButton.setAttribute('scale', '0.3 0.3 0.3')
      colorButton.setAttribute('position', '0 0 0.58')
      colorButton.setAttribute('button-style', 'color', buttonColor)
      colorButton.setAttribute('icon-button', '')
      colorButton.setAttribute('tooltip', 'Set Color')

      colorButton.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();

        light.setAttribute('light', 'color', this.el.sceneEl.systems['paint-system'].data.color)
        colorButton.setAttribute('button-style', 'color', this.el.sceneEl.systems['paint-system'].data.color)

        return true;
      })
      this.el.sceneEl.emit('refreshobjects')

    },
    click: function() {
      this.light.setAttribute('visible', !this.light.getAttribute('visible'))
    },
    bbuttondown: function() {
      this.clone()
    }
  },
  init() {
    let handle = document.createElement('a-entity')
    this.el.append(handle)
    handle.setAttribute('gltf-model', '#asset-spotlight')
    handle.setAttribute('scale', '0.3 0.3 0.3')
    handle.setAttribute('material', 'src: #asset-shelf; metalness: 0.8; roughness: 0.2')
    handle.setAttribute('apply-material-to-mesh', '')
    handle.classList.add('clickable')
    handle['redirect-grab'] = this.el
  },
  clone() {
    if (!this.light) return;
    let clone = document.createElement('a-entity')
    this.el.parentEl.append(clone)
    clone.setAttribute('light-tool', '')
    Util.whenLoaded(clone, () => {
      clone.setAttribute('light-tool-light', AFRAME.utils.styleParser.stringify(this.light.getAttribute('light')))
      Util.positionObject3DAtTarget(clone.object3D, this.el.object3D)
      Util.whenComponentInitialized(clone, 'light-tool', () => {
        if (this.light.getAttribute('visible')) {
          console.log("Autoactivating clone", clone)
          clone.emit('activate')
          clone.addState('grab-activated')
        }
      })
    })
  }
})

AFRAME.registerComponent('light-bauble', {
  dependencies: ['six-dof-tool', 'grab-activate'],
  events: {
    activate: function() {
      console.log("Activating", 'light-bauble')
      this.system.activateShadow()

      this.light = document.createElement('a-entity')
      this.el.sceneEl.append(this.light)

      let lightTarget = document.createElement('a-entity')
      this.el.sceneEl.append(lightTarget)
      lightTarget.setAttribute('position', '0 1 0')

      let shadowBoxSize = 0.5;
      this.light.setAttribute('light', `type: directional; castShadow: true; intensity: 5; shadowMapWidth: 1024; shadowCameraVisible: false; shadowMapHeight: 1024; shadowCameraLeft: -${shadowBoxSize}; shadowCameraRight: ${shadowBoxSize}; shadowCameraTop: ${shadowBoxSize}; shadowCameraBottom: -${shadowBoxSize}`)
      this.light.setAttribute('light', 'target', lightTarget)
      this.light.setAttribute('fix-light-shadow', '')

      this.el.sceneEl.systems['manipulator'].installConstraint(this.el, this.sunMoved.bind(this), POST_MANIPULATION_PRIORITY)
    },
    'bbuttonup': function(e) {
      if (this.el.is("grabbed"))
      {
        this.makeClone()
      }
    }
  },
  init() {
    Pool.init(this)
    this.system = this.el.sceneEl.systems['light-tool']
    this.el.classList.add('grab-root')

    // let ground = this.el.sceneEl.systems['pencil-tool'].createHandle({radius: 0.3, height: 0.03})
    // this.el.append(ground)
    let sun = document.createElement('a-entity')
    this.el.append(sun)
    sun.classList.add('clickable')
    sun['redirect-grab'] = this.el
    sun.setAttribute('geometry', 'primitive: sphere; segmentsWidth: 8; segmentsHeight: 8; radius: 0.5')
    sun.setAttribute('material', 'shader: matcap; color: #ffffe3')
    this.sun = sun
  },
  sunMoved(el) {
    if (!this.light) return
    let spherical = this.pool('spherical', THREE.Spherical)
    this.light.setAttribute('light', 'intensity', THREE.MathUtils.mapLinear(this.el.object3D.scale.x, 0, 0.065, 0, 3))
    this.sun.object3D.getWorldPosition(this.light.object3D.position)
    this.light.object3D.position.y -= 1.0
    spherical.setFromCartesianCoords(this.light.object3D.position.x, this.light.object3D.position.y, this.light.object3D.position.z)
    spherical.radius = 5
    this.light.object3D.position.setFromSpherical(spherical)
  },
  makeClone() {
    let el = document.createElement('a-entity')
    this.el.parentEl.append(el)
    Util.whenLoaded(el, () => {
      Util.positionObject3DAtTarget(el.object3D, this.el.object3D)
      el.setAttribute(this.attrName, this.data)
    })
  }
})

AFRAME.registerComponent('tonemapping-tooltip', {
  init() {
    this.mappings = Object.keys(THREE).filter(k => /ToneMapping/.test(k))
    this.setMapping = this.setMapping.bind(this)
    Util.whenLoaded(this.el.sceneEl, () => this.setMapping({detail: this.el.sceneEl.renderer.toneMapping}))
  },
  play() {
    this.el.sceneEl.addEventListener('tonemappingchanged', this.setMapping)

  },
  pause() {
    this.el.sceneEl.removeEventListener('tonemappingchanged', this.setMapping)
  },
  setMapping(e) {
    this.el.setAttribute('tooltip__tonemapping', this.mappings.find(m => THREE[m] == e.detail))
  }
})

AFRAME.registerComponent('fix-doublesided-shadow', {
  events: {
    object3dset: function(e) {
      this.updateShadow()
    }
  },
  play() {
    this.updateShadow()
  },
  updateShadow() {
    this.el.object3D.traverse(o => {
      // if (o.material)
      if (o.material && o.material.side === THREE.DoubleSide)
      {
        o.material.shadowSide = THREE.FrontSide
        o.material.needsUpdate = true
      }
    })
  }
})
