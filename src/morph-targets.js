import {Util} from './util.js'
import shortid from 'shortid'

AFRAME.registerComponent('morph-lever', {
  schema: {
    name: {type: 'string'},
    value: {default: 0.0},
    hubsAudio: {default: false},
    editing: {default: false},
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
    popupshown: function(e) {
      e.preventDefault()
      e.stopPropagation()
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
    let labelContainer = document.createElement('a-entity')
    this.el.append(labelContainer)
    labelContainer.append(label)
    this.label = label
    label.setAttribute('text', `value: ${this.data.name}; align: center; anchor: center; wrapCount: 15; width: 2; xOffset: 1.25; yOffset: 0.4`)
    label.setAttribute('position', '-0.65 0.2 0')
    label.setAttribute('scale', '0.5 0.5 1')
    label.setAttribute('edit-field', {type: 'string', component: "morph-lever", property: "name", target: this.el, tooltip: 'Rename'})
    // label.setAttribute('edit-field', 'target', this.el)

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

    let editingButton = document.createElement('a-entity')
    this.el.append(editingButton)
    editingButton.setAttribute('icon-button', '#asset-lead-pencil')
    editingButton.setAttribute('position', '-0.45 -0.75 0')
    editingButton.setAttribute('scale', '0.5 0.5 0.5')
    editingButton.setAttribute('tooltip', 'Edit')
    editingButton.setAttribute('tooltip-style', 'scale: 0.5 0.5 0.5')
    Util.whenLoaded(editingButton, () => {
      editingButton.setAttribute('toggle-button', {
        target: this.el,
        component: 'morph-lever',
        property: 'editing'
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

    if (this.data.editing && !oldData.editing)
    {
      this.el.sceneEl.systems['morph-targets'].startEditing(this.data.name)
    }
    else if (!this.data.editing && oldData.editing)
    {
      this.el.sceneEl.systems['morph-targets'].finishEditing()
    }

    if (this.data.name && this.data.name !== oldData.name && oldData.name)
    {
      let oldName = oldData.name
      let name = this.data.name
      for (let mesh of Compositor.nonCanvasMeshes)
      {
        if (!(oldName in mesh.morphTargetDictionary)){
          console.warn(`Can't find ${oldName} to rename in`, mesh)
          continue
        }
        let idx = mesh.morphTargetDictionary[oldName]

        mesh.morphTargetDictionary[name] = idx
        for (let attr of Object.values(mesh.geometry.morphAttributes))
        {
          attr[idx].name = name
        }

        delete mesh.morphTargetDictionary[oldName]
      }
    }
  }
})

Util.registerComponentSystem('morph-targets', {
  init() {
    this.originalPosition = {}
    this.originalNormal = {}
  },
  newMorphTarget(name) {
    if (!name) name = shortid.generate();

    let seenGeometries = {}
    let p = new THREE.Vector3()
    let o = new THREE.Vector3()
    for (let mesh of Compositor.nonCanvasMeshes)
    {
      let geometry = mesh.geometry
      if (!(geometry.uuid in seenGeometries))
      {
        let attribute = geometry.attributes.position.clone()
        if (geometry.morphTargetsRelative)
        {
            attribute.array.fill(0)
        }

        attribute.needsUpdate = true

        attribute.name = name

        if (!geometry.morphAttributes) geometry.morphAttributes = {}
        if (!geometry.morphAttributes['position']) geometry.morphAttributes['position'] = []
        geometry.morphAttributes['position'].push(attribute)
        seenGeometries[geometry.uuid] = geometry.morphAttributes['position'].length - 1
      }

      if (!mesh.morphTargetDictionary) mesh.morphTargetDictionary = {}
      if (!mesh.morphTargetInfluences) mesh.morphTargetInfluences = []
      mesh.morphTargetDictionary[name] = seenGeometries[geometry.uuid]
      mesh.morphTargetInfluences[seenGeometries[geometry.uuid]] = 0
    }

    // Work around https://github.com/mrdoob/three.js/pull/20845
    let clonedGeometries = {}
    for (let mesh of Compositor.nonCanvasMeshes)
    {
      let geometry = mesh.geometry
      if (!(geometry.uuid in seenGeometries)) continue
      if (!(geometry.uuid in clonedGeometries))
      {
        clonedGeometries[geometry.uuid] = geometry.clone()
      }

      mesh.geometry = clonedGeometries[geometry.uuid]
    }

    this.el.emit('morphtargetsupdated')
  },
  bakeMorphTarget() {
    let p = new THREE.Vector3()
    let m = new THREE.Vector3()
    let o = new THREE.Vector3()
    let seenGeometries = new Set()
    for (let mesh of Compositor.nonCanvasMeshes)
    {
      if (!mesh.morphTargetInfluences) continue;
      if (seenGeometries.has(mesh.geometry)) continue
      for (let attrName of ['position', 'normal'])
      {
        let attribute = mesh.geometry.attributes[attrName]
        let originalPositions = mesh.geometry.morphTargetsRelative ? null : attribute.clone()

        if (!mesh.geometry.morphAttributes[attrName]) continue;

        for (let morphIndex in mesh.morphTargetInfluences)
        {
          let influence = mesh.morphTargetInfluences[morphIndex]
          if (influence === 0.0) continue;

          let morphAttribute = mesh.geometry.morphAttributes[attrName][morphIndex]

          for (let i = 0; i < attribute.count; ++i)
          {
            p.fromBufferAttribute(attribute, i)
            m.fromBufferAttribute(morphAttribute, i)

            if ( mesh.geometry.morphTargetsRelative ) {
      				p.addScaledVector(m, influence);
      			} else {
              o.fromBufferAttribute(originalPositions, i)
      				p.addScaledVector(m.sub(o), influence);
      			}
            attribute.setXYZ(i, p.x, p.y, p.z)
          }

          mesh.morphTargetInfluences[morphIndex] = 0
        }
        attribute.needsUpdate = true
      }
      seenGeometries.add(mesh.geometry)
    }
  },
  newTarget(geometry, name) {

    if (!geometry.morphAttributes) {
      geometry.morphAttributes = {}
    }

    if (!geometry.morphAttributes.position)
    {
      geometry.morphAttributes.position = []
    }

    let newBuffer = geometry.attributes.position.clone()
    newBuffer.name = name

    if (geometry.morphTargetsRelative)
    {
      newBuffer.array.fill(0)
    }

    geometry.morphAttributes.position.push(newBuffer)
  },
  startEditing(name)
  {
    if (this.editing && this.editing !== name)
    {
      this.finishEditing();
    }

    for (let mesh of Compositor.meshes) {
      if (mesh.morphTargetInfluences)
      {
        for (let i = 0; i < mesh.morphTargetInfluences.length; ++i)
        {
          mesh.morphTargetInfluences[i] = 0
        }

        mesh.morphTargetInfluences[mesh.morphTargetDictionary[name]] = 1
      }
    }

    for (let geometry of Compositor.nonCanvasGeometries)
    {
      this.originalPosition[geometry.id] = geometry.attributes.position.clone()
      this.originalNormal[geometry.id] = geometry.attributes.normal.clone()

      if (!geometry.morphAttributes.normal)
      {
        geometry.morphAttributes.normal = []
        for (let i = 0; i < geometry.morphAttributes.position.length; ++i)
        {
          geometry.morphAttributes.normal[i] = geometry.attributes.normal.clone()
          geometry.morphAttributes.normal[i].name = geometry.morphAttributes.position[i].name
          if (geometry.morphTargetsRelative)
          {
            geometry.morphAttributes.normal[i].array.fill(0)
          }
        }
      }
    }

    this.bakeMorphTarget()
    this.editing = name

    this.el.sceneEl.setAttribute('vertex-editing', {editMeshVertices: true})
  },
  finishEditing()
  {
    if (!this.editing) return;
    this.el.sceneEl.setAttribute('vertex-editing', {editMeshVertices: false})

    let p = new THREE.Vector3()
    let o = new THREE.Vector3()
    for (let geometry of Compositor.nonCanvasGeometries)
    {
      for (let attr of ['position', 'normal'])
      {
        let original = this[attr === 'position' ? 'originalPosition' : 'originalNormal'][geometry.id]
        let position = geometry.attributes[attr]

        if (!original) {
          console.warn(`No saved ${attr} for`, geometry)
          continue
        }

        console.log("Finished Editing", attr, position, original)

        if (geometry.morphTargetsRelative)
        {
          for (let i = 0; i < position.count; ++i)
          {
            o.fromBufferAttribute(original, i)
            p.fromBufferAttribute(position, i)
            p.sub(o)
            position.setXYZ(i, p.x, p.y, p.z)
          }
          position.needsUpdate = true
        }

        position.name = name

        for (let i = 0; geometry.morphAttributes[attr] && i < geometry.morphAttributes[attr].length; ++i)
        {
          if (geometry.morphAttributes[attr][i].name !== this.editing) continue;

          geometry.morphAttributes[attr][i] = position
        }
        geometry.attributes[attr] = original
      }
    }
    this.el.emit('morphtargetsupdated')
  }
})

AFRAME.registerComponent('morph-target-shelf', {
  init() {
    this.populate = this.populate.bind(this)
    this.el.sceneEl.addEventListener('morphtargetsupdated', this.populate)
  },
  remove() {
    this.el.sceneEl.removeEventListener('morphtargetsupdated', this.populate)
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
      console.log("Shown popup", e)
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

      for (let [name, idx] of Object.entries(mesh.morphTargetDictionary).sort((a,b) => a[1] - b[1]))
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
