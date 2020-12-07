import {Util} from './util.js'

AFRAME.registerComponent('morph-lever', {
  schema: {
    name: {type: 'string'},
    value: {default: 0.0},
    hubsAudio: {default: false},
  },
  events: {
    anglechanged: function (e) {
      for (let mesh of Compositor.meshes) {
        if (mesh.morphTargetDictionary && (this.data.name in mesh.morphTargetDictionary))
        {
          mesh.morphTargetInfluences[mesh.morphTargetDictionary[this.data.name]] = e.detail.value
        }
      }
    },
    click: function(e) {
      this.el.querySelector('*[lever]').components['lever'].setValue(0)
      for (let mesh of Compositor.meshes) {
        if (mesh.morphTargetDictionary && (this.data.name in mesh.morphTargetDictionary))
        {
          mesh.morphTargetInfluences[mesh.morphTargetDictionary[this.data.name]] = 0
        }
      }
    }
  },
  init() {
    let label = document.createElement('a-entity')
    this.label = label
    label.setAttribute('text', `value: ${this.data.name}; align: center; anchor: center; wrapCount: 15; width: 0.8`)
    label.setAttribute('position', '0 0.2 0')
    this.el.append(label)

    let lever = document.createElement('a-entity')
    this.el.append(lever)
    lever.setAttribute('lever', `valueRange: 1 -1; initialValue: ${this.data.value}`)
    lever.setAttribute('scale', '1.5 1.5 1.5')

    for (let mesh of Compositor.nonCanvasMeshes)
    {
      if ( mesh.userData
        && mesh.userData.gltfExtensions
        && mesh.userData.gltfExtensions.MOZ_hubs_components
        && mesh.userData.gltfExtensions.MOZ_hubs_components['morph-audio-feedback']
        && mesh.userData.gltfExtensions.MOZ_hubs_components['morph-audio-feedback'].name === this.data.name
      )
      {
        this.data.hubsAudio = true
      }
    }

    let hubsAudioButton = document.createElement('a-entity')
    this.el.append(hubsAudioButton)
    hubsAudioButton.setAttribute('icon-button', '#asset-ear-hearing')
    hubsAudioButton.setAttribute('position', '0 -0.5 0')
    hubsAudioButton.setAttribute('scale', '0.5 0.5 0.5')
    hubsAudioButton.setAttribute('tooltip', 'Set as Mozilla Hubs Avatar Audio Feedback')
    hubsAudioButton.setAttribute('tooltip-style', 'scale: 0.5 0.5 0.5')
    Util.whenLoaded(hubsAudioButton, () => {
      hubsAudioButton.setAttribute('toggle-button', {
        target: this.el,
        component: 'morph-lever',
        property: 'hubsAudio'
      })
    })
  },
  update(oldData) {
    if (this.data.hubsAudio)
    {
      for (let mesh of Compositor.nonCanvasMeshes)
      {
        if (!mesh.userData.gltfExtensions) mesh.userData.gltfExtensions = {}
        if (!mesh.userData.gltfExtensions.MOZ_hubs_components) mesh.userData.gltfExtensions.MOZ_hubs_components = {}
        mesh.userData.gltfExtensions.MOZ_hubs_components['morph-audio-feedback'] = {
          name: this.data.name,
          minValue: 0,
          maxValue: 1,
        }
      }

      this.el.emit('hubsaudioset', this.data.name)
    }
    else
    {
      for (let mesh of Compositor.nonCanvasMeshes)
      {
        if ( mesh.userData
          && mesh.userData.gltfExtensions
          && mesh.userData.gltfExtensions.MOZ_hubs_components
          && mesh.userData.gltfExtensions.MOZ_hubs_components['morph-audio-feedback']
          && mesh.userData.gltfExtensions.MOZ_hubs_components['morph-audio-feedback'].name === this.data.name
        )
        {
          delete mesh.userData.gltfExtensions.MOZ_hubs_components['morph-audio-feedback'];
        }
      }
    }
  }
})

AFRAME.registerComponent('morph-target-shelf', {
  init() {
  },
  events: {
    hubsaudioset: function (e) {
      this.el.querySelectorAll("*[morph-lever]").forEach(el => {
        if (el.hasLoaded && el.getAttribute('morph-lever').name !== e.detail)
        {
          el.setAttribute('morph-lever', 'hubsAudio', false)
        }
      })
    },
    popupshown: function (e) {
      Compositor.material.morphTargets = true
      Compositor.material.needsUpdate = true
      this.populate()
    },
    popuphidden: function (e) {
      Compositor.material.morphTargets = false
      Compositor.material.needsUpdate = true
    },
  },
  populate() {
    let container = this.el.querySelector(".morph-levers")
    container.getChildEntities().forEach(e => e.remove())
    let x = 0
    let y = 0
    let xSpacing = 0.9
    let ySpacing = 0.5

    let existingTargetValues = {}
    for (let mesh of Compositor.nonCanvasMeshes)
    {
      console.log("Adding mesh to morph targets", mesh.name)
      if (!mesh.morphTargetDictionary) continue;

      for (let name in mesh.morphTargetDictionary)
      {
        if (name in existingTargetValues)
        {
          mesh.morphTargetInfluences[mesh.morphTargetDictionary[name]] = existingTargetValues[name]
          continue
        }

        console.log("Adding morph target", name)

        existingTargetValues[name] = mesh.morphTargetInfluences[mesh.morphTargetDictionary[name]]
        let lever = document.createElement('a-entity')
        lever.setAttribute('position', `${x++ * xSpacing} ${y * ySpacing} 0`)
        lever.setAttribute('morph-lever', `name: ${name}; value: ${existingTargetValues[name]}`)
        lever.setAttribute('scale', '2 2 2')
        container.append(lever)
      }
    }

    container.setAttribute('position', `${-(x - 1) * xSpacing / 2} 0 0`)
    this.el.setAttribute('shelf', 'width', (Math.max(x, 2) * xSpacing))
  }
})
