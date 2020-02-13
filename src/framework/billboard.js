/*
The MIT License (MIT)

Copyright (c) 2015 Kevin Ngo

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

AFRAME.registerComponent("billboard", {
  schema: {
    enabled: {default: true}
  },
  init: function() {
    this.target = new THREE.Vector3();
  },
  tick: function() {
    if (!this.data.enabled) return
    const camera = this.el.sceneEl.camera;
    const object3D = this.el.object3D;

    if (camera) {
      // Set the camera world position as the target.
      this.target.setFromMatrixPosition(camera.matrixWorld);
      return object3D.lookAt(this.target);
    }
  }
});
