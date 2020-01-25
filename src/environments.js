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
    }

    envEl.setAttribute('environment', {preset})
  }
}

const Environments = new EnvironmentManager

export {Environments}
