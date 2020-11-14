AFRAME.registerComponent('scalable-raycaster', {
  dependencies: ['raycaster'],
  init()  {
    let worldScale = new THREE.Vector3
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
