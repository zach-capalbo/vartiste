(function () {
      let _updateMatrixWorld = THREE.Object3D.prototype.updateMatrixWorld
      THREE.Object3D.prototype.updateMatrixWorld = function () {
        if (!this.visible) {
          return
        }
        _updateMatrixWorld.apply(this)
      }
  })();
