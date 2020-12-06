AFRAME.registerComponent('morph-lever', {
  schema: {
    name: {type: 'string'},
    value: {default: 0.0},
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
      this.el.components['lever'].setValue(0)
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
    lever.setAttribute('lever', 'valueRange: 1 -1')
    lever.setAttribute('scale', '1.5 1.5 1.5')
    this.el.append(lever)
  }
})

AFRAME.registerComponent('morph-target-shelf', {
  init() {
    Compositor.material.morphTargets = true
    Compositor.material.needsUpdate = true
    this.populate()
  },
  populate() {
    let container = this.el.querySelector(".morph-levers")
    // container.clear()
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
    this.el.setAttribute('shelf', 'width', (Math.max(x, 1) * xSpacing))
  }
})
