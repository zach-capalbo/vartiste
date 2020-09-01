/*
The MIT License (MIT)

Copyright (c) 2016 Don McCurdy

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

Modified 2020 by Zach Capalbo
*/

import Leap from 'leapjs';
window.Leap = Leap
import { HandMesh } from './leap.hand-mesh.js';
import { transform } from './leap.transform.js';
import { HandHold } from './leap.hand-hold.js';

function CircularArray (size) {
  this._index = 0;
  this._size = size;
  this._array = [];
}

CircularArray.prototype._incr = function () { this._index = ++this._index % this._size; };
CircularArray.prototype.array = function () { return this._array; };
CircularArray.prototype.push = function (value) {
  this._array[this._index] = value;
  this._incr();
};

/**
 * Helper for raycasting, which chooses a raycaster direction based on hand position. Also supports
 * a debugging mode, in which the ray is visible.
 */
function Intersector () {
  this.arrowHelper = this.createArrowHelper();
  this.raycaster = new THREE.Raycaster(new THREE.Vector3(), new THREE.Vector3(), 0, 0.2);
}

Intersector.prototype.update = function (options, object3D, hand, isHolding) {
  // Update options.
  this.holdDistance = options.holdDistance;
  this.debug = options.debug;

  // Update raycaster.
  this.raycaster.far = this.holdDistance;
  this.raycaster.ray.direction.fromArray(hand.palmNormal);
  this.raycaster.ray.direction.multiplyScalar(-1)
  // this.raycaster.ray.direction.x += hand.direction[0] / 2;
  // this.raycaster.ray.direction.y += hand.direction[1] / 2;
  // this.raycaster.ray.direction.z += hand.direction[2] / 2;
  this.raycaster.ray.direction.normalize();
  this.raycaster.ray.origin.fromArray(hand.palmPosition);
  object3D.localToWorld(this.raycaster.ray.origin);

  // Update arrow helper.
  if (this.debug) {
    this.arrowHelper = this.arrowHelper || this.createArrowHelper();
    this.arrowHelper.position.copy(this.raycaster.ray.origin);
    object3D.worldToLocal(this.arrowHelper.position);
    this.arrowHelper.setDirection(this.raycaster.ray.direction);
    this.arrowHelper.setLength(this.holdDistance);
    this.arrowHelper.setColor(isHolding ? 0xFF0000 : 0x00FF00);
  } else {
    delete this.arrowHelper;
  }
};

Intersector.prototype.intersectObjects = function (objects, isRecursive) {
  return this.raycaster.intersectObjects(objects, isRecursive);
};

/** @return {THREE.ArrowHelper} */
Intersector.prototype.createArrowHelper = function () {
  return new THREE.ArrowHelper(
    new THREE.Vector3(1, 0, 0),
    new THREE.Vector3(),
    this.holdDistance
  );
};

/** @return {THREE.Object3D} */
Intersector.prototype.getMesh = function () {
  return this.arrowHelper;
};

/** @return {Intersector} */
Intersector.prototype.show = function () {
  if (this.arrowHelper) this.arrowHelper.visible = true;
  return this;
};

/** @return {Intersector} */
Intersector.prototype.hide = function () {
  if (this.arrowHelper) this.arrowHelper.visible = false;
  return this;
};

export { Intersector };

// Defaults from leap.transform.js.
var DEFAULT_SCALE = 0.001;
var DEFAULT_POSITION = new THREE.Vector3();
var DEFAULT_QUATERNION = new THREE.Quaternion();

Leap.Controller.plugin('transform', transform);

/**
 * Leap Motion system for A-Frame.
 */
export const System = AFRAME.registerSystem('leap', {
  schema: {
    // vr: {default: 'desktop'},
    vr: {default: true},
    scale: {default: DEFAULT_SCALE},
    position: {
      type: 'vec3',
      default: {
        x: DEFAULT_POSITION.x,
        y: DEFAULT_POSITION.y,
        z: DEFAULT_POSITION.z,
      }
    },
    quaternion: {
      type: 'vec4',
      default: {
        x: DEFAULT_QUATERNION.x,
        y: DEFAULT_QUATERNION.y,
        z: DEFAULT_QUATERNION.z,
        w: DEFAULT_QUATERNION.w
      }
    }
  },

  init: function () {
    this.controller = Leap.loop()
      .use('transform', this.data);
  },

  getFrame: function () {
    return this.controller.frame();
  }
});

var nextID = 1;

/**
 * A-Frame component for a single Leap Motion hand.
 */
const Component = AFRAME.registerComponent('leap-hand', {
  schema: {
    hand:               {default: '', oneOf: ['left', 'right'], required: true},
    enablePhysics:      {default: false},
    holdDistance:       {default: 0.2}, // m
    holdDebounce:       {default: 100}, // ms
    holdSelector:       {default: '[holdable]'},
    holdSensitivity:    {default: 0.95}, // [0,1]
    releaseSensitivity: {default: 0.75}, // [0,1]
    pinchPressureStart: {default: 0.75}, // [0, 1]
    debug:              {default: true},

    emulateConfig:      {default: 'vive-controls'}
  },

  init: function () {
    this.system = this.el.sceneEl.systems.leap;

    this.handID = nextID++;
    this.hand = /** @type {Leap.Hand} */ null;
    this.handBody = /** @type {HandBody} */ null;
    this.handMesh = new HandMesh();

    this.isVisible = false;
    this.isHolding = false;

    var bufferLen = Math.floor(this.data.holdDebounce / (1000 / 120));
    this.grabStrength = 0;
    this.pinchStrength = 0;
    this.grabStrengthBuffer = /** @type {CircularArray<number>} */ new CircularArray(bufferLen);
    this.pinchStrengthBuffer = /** @type {CircularArray<number>} */ new CircularArray(bufferLen);

    this.intersector = new Intersector();
    this.holdTarget = /** @type {AFRAME.Element} */ null;

    let meshMesh = this.handMesh.getMesh()
    this.el.setObject3D('mesh', meshMesh);
    this.el.object3D.parent.add(meshMesh)
    this.handMesh.hide();
    this.el.emit('controllermodelready', {name: this.data.emulateConfig})

    this.pinchEvent = {}

    if (this.data.debug) {
      this.el.object3D.add(this.intersector.getMesh());
    }
  },

  update: function () {
    var data = this.data;
    if (data.enablePhysics && !this.handBody) {
      this.handBody = new HandBody(this.el, this);
    } else if (!data.enablePhysics && this.handBody) {
      this.handBody.remove();
      this.handBody = null;
    }
  },

  remove: function () {
    if (this.handMesh) {
      this.el.removeObject3D('mesh');
      this.handMesh = null;
    }
    if (this.handBody) {
      this.handBody.remove();
      this.handBody = null;
    }
    if (this.intersector.getMesh()) {
      this.el.object3D.remove(this.intersector.getMesh());
      this.intersector = null;
    }
  },

  tick: function () {
    var hand = this.getHand();
    this.hand = hand

    if (hand && hand.valid) {
      this.palmDirection = this.palmDirection || new THREE.Vector3()
      this.handDirection = this.handDirection || new THREE.Vector3()
      this.handDirectionQuaternion = this.handDirectionQuaternion || new THREE.Quaternion()
      this.cameraMatrix = this.cameraMatrix || new THREE.Matrix4()
      this.inverseMatrix = this.inverseMatrix || new THREE.Matrix4()

      this.el.object3D.position.fromArray(hand.palmPosition)

      this.palmDirection.fromArray(hand.palmNormal)
      this.palmDirection.multiplyScalar(-1)

      this.handDirection.fromArray(hand.direction)

      this.el.object3D.matrix.lookAt(this.palmDirection, new THREE.Vector3, this.el.sceneEl.object3D.up)
      this.el.object3D.quaternion.setFromRotationMatrix(this.el.object3D.matrix)

      // this.el.object3D.matrix.lookAt(this.handDirection, new THREE.Vector3, this.el.sceneEl.object3D.up)
      // this.handDirectionQuaternion.setFromRotationMatrix(this.el.object3D.matrix)
      // this.el.object3D.quaternion.slerp(this.handDirectionQuaternion, 0.3)
      // this.el.object3D.updateMatrix()

      // let cameraObject = document.getElementById('camera').object3D
      // cameraObject.updateMatrix()
      // this.cameraMatrix.compose(cameraObject.position, cameraObject.quaternion, cameraObject.scale)
      // this.inverseMatrix.getInverse(this.cameraMatrix)

      // this.el.object3D.matrix.multiply(this.cameraMatrix)
      // this.el.object3D.matrix.decompose(this.el.object3D.position, this.el.object3D.quaternion, this.el.object3D.scale)

      if (this.el.hasAttribute('smooth-controller'))
      {
        this.el.components['smooth-controller'].stabilize(3)
      }

      this.handMesh.scaleTo(hand);
      this.handMesh.formTo(hand);
      // this.handMesh.object3D.matrix.multiply(this.cameraMatrix)
      // this.handMesh.object3D.matrix.decompose(this.handMesh.object3D.position, this.handMesh.object3D.quaternion, this.handMesh.object3D.scale)
      this.grabStrengthBuffer.push(hand.grabStrength);
      this.pinchStrengthBuffer.push(hand.pinchStrength);
      this.grabStrength = circularArrayAvg(this.grabStrengthBuffer);
      this.pinchStrength = circularArrayAvg(this.pinchStrengthBuffer);
      var isHolding = this.grabStrength
        > (this.isHolding ? this.data.releaseSensitivity : this.data.holdSensitivity);
      var isPinching = !isHolding && this.pinchStrength
        > (this.isPinching ? this.data.releaseSensitivity : this.data.holdSensitivity);
      this.intersector.update(this.data, this.el.object3D, hand, isHolding || isPinching);
      this.pinchEvent.value = THREE.Math.mapLinear(this.pinchStrength, this.data.pinchPressureStart, 1, 0, 1)
      this.el.emit('triggerchanged', this.pinchEvent)
      if (isPinching && !this.isPinching) this.pinch(hand);
      if (!isPinching && this.isPinching) this.unpinch(hand);
      if ( isHolding && !this.isHolding) this.hold(hand);
      if (!isHolding &&  this.isHolding) this.release(hand);
    } else if (this.isHolding) {
      this.release(null);
    }

    if (hand && !this.isVisible) {
      this.handMesh.show();
      this.intersector.show();
      this.el.emit('controllerconnected', {name: this.data.emulateConfig})
    }

    if (!hand && this.isVisible) {
      this.handMesh.hide();
      this.intersector.hide();
      this.el.emit('controllerdisconnected', {name: this.data.emulateConfig})
    }
    this.isVisible = !!hand;
  },

  getHand: function () {
    var data = this.data,
        frame = this.system.getFrame();
    return frame.hands.length ? frame.hands[frame.hands[0].type === data.hand ? 0 : 1] : null;
  },

  hold: function (hand) {
    this.el.emit('gripdown')
    this.isHolding = true;
  },

  pinch: function (hand) {
    this.el.emit('triggerdown')
    this.isPinching = true
  },

  unpinch: function(hand) {
    this.el.emit('triggerup')
    this.isPinching = false
  },

  release: function (hand) {
    this.el.emit('gripup')
    this.isHolding = false;
  },

  getEventDetail: function (hand) {
    return {
      hand: hand,
      handID: this.handID,
      body: this.handBody ? this.handBody.palmBody : null
    };
  }
});

function circularArrayAvg (array) {
  var avg = 0;
  array = array.array();
  for (var i = 0; i < array.length; i++) {
    avg += array[i];
  }
  return avg / array.length;
}

export { Component };
