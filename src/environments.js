class EnvironmentManager {
  constructor() {
  }
  installSkybox(skybox) {
    // if (typeof skybox === 'undefined') skybox = require('./assets/skybox.jpg')

    let skyEl = document.getElementsByTagName('a-sky')[0]
    skyEl.setAttribute('src', skybox)
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
