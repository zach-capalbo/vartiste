import Color from 'color'
class EnvironmentManager {
  constructor() {
  }
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
  }
  installPresetEnvironment(preset = "starry") {
    let envEl = document.querySelector('*[environment]')

    if (!envEl) {
      envEl = document.createElement('a-entity')
      document.getElementsByTagName('a-scene')[0].append(envEl)
      envEl.setAttribute('position', '0 -7 0')
    }

    envEl.setAttribute('environment', {preset})
  }
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
  }
  toggle() {
    let envEl = document.querySelector('*[environment]')
    if (!envEl || !envEl.getAttribute('visible'))
    {
      this.installPresetEnvironment()
      return
    }

    this.removePresetEnvironment()
  }
}

const Environments = new EnvironmentManager

export {Environments}
