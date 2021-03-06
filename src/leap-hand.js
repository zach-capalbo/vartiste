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
import { HandMesh } from './framework/leap.hand-mesh.js';
import { transform } from './framework/leap.transform.js';
import { HandHold } from './framework/leap.hand-hold.js';

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
  if (this.arrowHelper) this.arrowHelper.visible = false;
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
    this.controller = Leap.loop({loopWhileDisconnected: false})
      .use('transform', this.data)
      .on('connect', () => {
        this.hasConnected = true
        this.el.sceneEl.emit('leap-connect')
      })
  },

  getFrame: function () {
    return this.controller.frame();
  },

  isConnected: function() {
    return this.controller.connected()
  }
});

var nextID = 1;

const COMPETING_COMPONENTS = ['valve-index-controls', 'oculus-touch-controls', 'vive-controls', 'tracked-controls-webxr', 'tracked-controls-webvr', 'tracked-controls'];

// Laser-pointer hand component for [Leap
// Motion](https://developer.leapmotion.com/) hand tracking. Intended to be used
// in VR/head mounted mode.
//
// Creates a hand and arm rig with a raycaster, which functions in a manner
// similar to `laser-controls`. Pinching the index finger and thumb simulate
// "click" events, and grabbing with the whole hand simulates "grip" events.
//
// Originally based on a component from Don McCurdy, but substantially modified.
AFRAME.registerComponent('leap-hand', {
  schema: {
    // `left` or `right`
    hand:               {default: '', oneOf: ['left', 'right'], required: true},

    // m
    holdDistance:       {default: 0.2},

    // ms
    holdDebounce:       {default: 100},

    // [0,1]
    holdSensitivity:    {default: 0.95},

    // [0,1]
    pinchSensitivity:    {default: 0.80},

    // [0,1]
    releaseSensitivity: {default: 0.75},

    // [0, 1]
    pinchPressureStart: {default: 0.75},

    debug:              {default: false},

    // Which controller configuration to emulate for `laser-controls` compatibility
    emulateConfig:      {default: 'vive-controls'},

    // Which button to emulate when pinched
    pinchButton:        {default: 'trigger'},

    // Which button to emulate when grabbed
    grabButton:         {default: 'grip'},
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
    if (!this.system.hasConnected) return
    if (!this.system.isConnected()) return
    var hand = this.getHand();
    this.hand = hand

    if (hand && hand.valid) {
      for (let component of COMPETING_COMPONENTS)
      {
        if (!(component in this.el.components)) continue
        this.el.components[component].pause()
        this.el.removeAttribute('gltf-model')
      }

      this.palmDirection = this.palmDirection || new THREE.Vector3()
      this.handDirection = this.handDirection || new THREE.Vector3()
      this.cameraMatrix = this.cameraMatrix || new THREE.Matrix4()
      this.originVector = this.originVector || new THREE.Vector3()

      this.el.object3D.position.fromArray(hand.palmPosition)

      this.palmDirection.fromArray(hand.palmNormal)
      this.palmDirection.multiplyScalar(-1)

      this.handDirection.fromArray(hand.direction)
      this.handDirection.multiplyScalar(-1)

      this.palmDirection.lerp(this.handDirection, 0.3)

      this.el.object3D.matrix.lookAt(this.palmDirection, this.originVector, this.el.sceneEl.object3D.up)
      this.el.object3D.quaternion.setFromRotationMatrix(this.el.object3D.matrix)

      if (this.el.sceneEl.is('vr-mode'))
      {
        let cameraObject = document.getElementById('camera-root').object3D
        this.cameraMatrix.compose(cameraObject.position, cameraObject.quaternion, cameraObject.scale)
        this.cameraMatrix.decompose(this.el.parentEl.object3D.position, this.el.parentEl.object3D.quaternion, this.el.parentEl.object3D.scale)
        this.el.parentEl.object3D.matrix.copy(this.cameraMatrix)
      }

      if (this.el.hasAttribute('smooth-controller'))
      {
        this.el.components['smooth-controller'].stabilize(3)
      }

      this.handMesh.scaleTo(hand);
      this.handMesh.formTo(hand);

      this.grabStrengthBuffer.push(hand.grabStrength);
      this.pinchStrengthBuffer.push(hand.pinchStrength);
      this.grabStrength = circularArrayAvg(this.grabStrengthBuffer);
      this.pinchStrength = circularArrayAvg(this.pinchStrengthBuffer);
      var isHolding = this.grabStrength
        > (this.isHolding ? this.data.releaseSensitivity : this.data.holdSensitivity);
      var isPinching = this.pinchStrength
        > (this.isPinching ? this.data.releaseSensitivity : this.data.pinchSensitivity);

      if ( isHolding && !this.isHolding) this.hold(hand);
      if (!isHolding &&  this.isHolding) this.release(hand);
      if (isPinching && !this.isPinching) this.pinch(hand);
      if (!isPinching && this.isPinching) this.unpinch(hand);

      if (!this.isHolding)
      {
        this.pinchEvent.value = THREE.Math.mapLinear(this.pinchStrength, this.data.pinchPressureStart, 1, 0, 1)
        this.el.emit('triggerchanged', this.pinchEvent)
      }
    } else if (this.isHolding) {
      this.release(null);
      this.unpinch(null)
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
    this.el.emit(`${this.data.grabButton}down`, {type: 'hand'})
    this.isHolding = true;
  },

  pinch: function (hand) {
    if (this.isHolding) return
    this.el.emit(`${this.data.pinchButton}down`)
    this.isPinching = true
  },

  unpinch: function(hand) {
    if (this.isHolding) return
    this.el.emit(`${this.data.pinchButton}up`)
    this.isPinching = false
  },

  release: function (hand) {
    this.el.emit(`${this.data.grabButton}up`, {type: 'hand'})
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

// export { Component };
