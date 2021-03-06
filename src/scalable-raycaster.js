// Makes `raycaster` respond appropriately when its world matrix is scaled
AFRAME.registerComponent('scalable-raycaster', {
  dependencies: ['raycaster'],
  init()  {
    let worldScale = new THREE.Vector3

    // TODO: Not sure why this breaks on oculus quest. Still needs this kind of correction
    if (false && !AFRAME.utils.device.isMobileVR())
    {
      this.el.components.raycaster.updateLine = AFRAME.utils.bind(function () {
        var el = this.el;
        var intersections = this.intersections;
        var lineLength;

        if (intersections.length) {
          this.el.object3D.getWorldScale(worldScale);
          let worldScaleFactor = Math.abs(worldScale.dot(this.data.direction));
          if (intersections[0].object.el === el && intersections[1]) {
            lineLength = intersections[1].distance / worldScaleFactor;
          } else {
            lineLength = intersections[0].distance / worldScaleFactor;
          }
        }
        this.drawLine(lineLength);
      }, this.el.components.raycaster);
    }

    let originalUpdateOriginDirection = this.el.components.raycaster.updateOriginDirection
    this.el.components.raycaster.updateOriginDirection = AFRAME.utils.bind(function () {
      originalUpdateOriginDirection.call(this)

      let data = this.data
      var raycaster = this.raycaster;

      // Set raycaster properties.
      raycaster.far = data.far;
      raycaster.near = data.near;

      // Calculate unit vector for line direction. Can be multiplied via scalar to performantly
      // adjust line length.
      this.unitLineEndVec3.copy(data.origin).add(data.direction).normalize();
    }, this.el.components.raycaster)
  }
})

AFRAME.registerComponent('raycaster-layers', {
  dependencies: ['raycaster'],
  schema: {
    layers: {type: 'array', default: ["default"]},
  },
  init() {
    this.system = this.el.sceneEl.systems['camera-layers']
  },
  update(oldData) {
    let layers = this.el.components.raycaster.raycaster.layers
    layers.mask = 0
    for (let layer of this.data.layers)
    {
      let number = parseInt(layer)

      if (isNaN(number))
      {
        number = this.system.camera_layers[layer]
        if (isNaN(number))
        {
          console.error('No such layer', number, layer)
          return
        }
      }

      layers.enable(number)
    }
  }
})
