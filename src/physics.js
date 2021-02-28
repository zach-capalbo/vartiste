/* global AFRAME, PHYSX, THREE, VARTISTE */

if (typeof PHYSX == 'undefined')
{
  require('./wasm/physx.release.js')
}

// Extra utility functions for dealing with PhysX
const PhysXUtil = {
    // Gets the world position transform of the given object3D in PhysX format
    object3DPhysXTransform: (() => {
      let pos = new THREE.Vector3();
      let quat = new THREE.Quaternion();
      return function (obj) {
        obj.getWorldPosition(pos);
        obj.getWorldQuaternion(quat);

        return {
          translation: {
            x: pos.x,
            y: pos.y,
            z: pos.z,
          },
          rotation: {
            w: quat.w, // PhysX uses WXYZ quaternions,
            x: quat.x,
            y: quat.y,
            z: quat.z,
          },
        }
      }
    })(),

  // Converts a THREE.Matrix4 into a PhysX transform
  matrixToTransform: (() => {
      let pos = new THREE.Vector3();
      let quat = new THREE.Quaternion();
      let scale = new THREE.Vector3();
      let scaleInv = new THREE.Matrix4();
      let mat2 = new THREE.Matrix4();
      return function (matrix) {
        matrix.decompose(pos, quat, scale);

        return {
          translation: {
            x: pos.x,
            y: pos.y,
            z: pos.z,
          },
          rotation: {
            w: quat.w, // PhysX uses WXYZ quaternions,
            x: quat.x,
            y: quat.y,
            z: quat.z,
          },
        }
      }
    })(),

  // Converts an arry of layer numbers to an integer bitmask
  layersToMask: (() => {
    let layers = new THREE.Layers();
    return function(layerArray) {
      layers.disableAll();
      for (let layer of layerArray)
      {
          layers.enable(parseInt(layer));
      }
      return layers.mask;
    };
  })()
};

let PhysX

// Implements the a physics system using an emscripten compiled PhysX engine.
// For a complete example of how to use this, you can see the
// [aframe-vartiste-toolkit Physics
// Playground](https://glitch.com/edit/#!/fascinated-hip-period?path=index.html)
// It is also helpful to refer to the [NVIDIA PhysX
// documentation](https://gameworksdocs.nvidia.com/PhysX/4.0/documentation/PhysXGuide/Manual/Index.html)
AFRAME.registerSystem('physx', {
  schema: {
    // Amount of time to wait after loading before starting the physics. Can be
    // useful if there is still some things loading or initializing elsewhere in
    // the scene
    delay: {default: 5000},

    // Throttle for running the physics simulation. On complex scenes, you can
    // increase this to avoid dropping video frames
    throttle: {default: 10},

    // If true, the PhysX will automatically be loaded and started. If false,
    // you will have to call `startPhysX()` manually to load and start the
    // physics engine
    autoLoad: {default: false},

    // Simulation speed multiplier. Increase or decrease to speed up or slow
    // down simulation time
    speed: {default: 1.0},

    // URL for the PhysX WASM bundle. If blank, it will be auto-located based on
    // the VARTISTE toolkit include path
    wasmUrl: {default: ""},

    // If true, sets up a default scene with a ground plane and bounding
    // cylinder.
    useDefaultScene: {default: true},
  },
  init() {
    this.PhysXUtil = PhysXUtil;

    this.objects = new Map();
    this.shapeMap = new Map();
    this.worldHelper = new THREE.Object3D();
    this.el.object3D.add(this.worldHelper);
    this.tock = AFRAME.utils.throttleTick(this.tock, this.data.throttle, this)
    this.collisionObject = {thisShape: null, otherShape:null, points: [], impulses: [], otherComponent: null};

    let defaultTarget = document.createElement('a-entity')
    this.el.append(defaultTarget)
    this.defaultTarget = defaultTarget

    this.initializePhysX = new Promise((r, e) => {
      this.fulfillPhysXPromise = r;
    })

    this.el.addEventListener('inspectortoggle', (e) => {
      console.log("Inspector toggle", e)
      if (e.detail === true)
      {
          this.running = false
      }
    })
  },
  findWasm() {
    if (this.data.wasmUrl) return this.data.wasmUrl;

    let path = require('./wasm/physx.release.wasm');
    if (window.VARTISTE_TOOLKIT_URL) {
      return `${window.VARTISTE_TOOLKIT_URL}/${path}`
    }

    return path
  },
  // Loads PhysX and starts the simulation
  async startPhysX() {
    this.running = true;
    let self = this;
    let resolveInitialized;
    let initialized = new Promise((r, e) => resolveInitialized = r)
    PhysX = PHYSX({
        locateFile(path) {
          if (path.endsWith('.wasm')) {
            return self.findWasm()
          }
          return path
        },
        onRuntimeInitialized() {
          resolveInitialized();
        }
      });
    if (PhysX instanceof Promise) PhysX = await PhysX;
    this.PhysX = PhysX;
    await initialized;
    self.startPhysXScene()
    self.physXInitialized = true
    self.fulfillPhysXPromise()
    self.el.emit('physx-started', {})
  },
  startPhysXScene() {
    console.info("Starting PhysX scene")
    const foundation = PhysX.PxCreateFoundation(
      PhysX.PX_PHYSICS_VERSION,
      new PhysX.PxDefaultAllocator(),
      new PhysX.PxDefaultErrorCallback()
    );
    this.foundation = foundation
    const physxSimulationCallbackInstance = PhysX.PxSimulationEventCallback.implement({
      onContactBegin: (shape0, shape1, points, impulses) => {
        let c0 = this.shapeMap.get(shape0.$$.ptr)
        let c1 = this.shapeMap.get(shape1.$$.ptr)

        if (c1 === c0) return;

        if (c0 && c0.data.emitCollisionEvents) {
          this.collisionObject.thisShape = shape0
          this.collisionObject.otherShape = shape1
          this.collisionObject.points = points
          this.collisionObject.impulses = impulses
          this.collisionObject.otherComponent = c1
          c0.el.emit('contactbegin', this.collisionObject)
        }

        if (c1 && c1.data.emitCollisionEvents) {
          this.collisionObject.thisShape = shape1
          this.collisionObject.otherShape = shape0
          this.collisionObject.points = points
          this.collisionObject.impulses = impulses
          this.collisionObject.otherComponent = c0
          c1.el.emit('contactbegin', this.collisionObject)
        }
      },
      onContactEnd: (shape0, shape1) => {
          let c0 = this.shapeMap.get(shape0.$$.ptr)
          let c1 = this.shapeMap.get(shape1.$$.ptr)

          if (c1 === c0) return;

        if (c0 && c0.data.emitCollisionEvents) {
          this.collisionObject.thisShape = shape0
          this.collisionObject.otherShape = shape1
          this.collisionObject.points = null
          this.collisionObject.impulses = null
          this.collisionObject.otherComponent = c1
          c0.el.emit('contactend', this.collisionObject)
        }

        if (c1 && c1.data.emitCollisionEvents) {
          this.collisionObject.thisShape = shape1
          this.collisionObject.otherShape = shape0
          this.collisionObject.points = null
          this.collisionObject.impulses = null
          this.collisionObject.otherComponent = c0
          c1.el.emit('contactend', this.collisionObject)
        }
      },
      onContactPersist: () => {},
      onTriggerBegin: () => {},
      onTriggerEnd: () => {},
    });
    let tolerance = new PhysX.PxTolerancesScale();
    // tolerance.length /= 10;
    // console.log("Tolerances", tolerance.length, tolerance.speed);
    this.physics = PhysX.PxCreatePhysics(
      PhysX.PX_PHYSICS_VERSION,
      foundation,
      tolerance,
      false,
      null
    )
    PhysX.PxInitExtensions(this.physics, null);

    this.cooking = PhysX.PxCreateCooking(
      PhysX.PX_PHYSICS_VERSION,
      foundation,
      new PhysX.PxCookingParams(tolerance)
    )

    const sceneDesc = PhysX.getDefaultSceneDesc(
      this.physics.getTolerancesScale(),
      0,
      physxSimulationCallbackInstance
    )
    this.scene = this.physics.createScene(sceneDesc)

    this.setupDefaultEnvironment()
  },
  setupDefaultEnvironment() {
    this.defaultActorFlags = new PhysX.PxShapeFlags(
      PhysX.PxShapeFlag.eSCENE_QUERY_SHAPE.value |
        PhysX.PxShapeFlag.eSIMULATION_SHAPE.value
    )
    this.defaultFilterData = new PhysX.PxFilterData(1, 1, 0, 0)

    if (this.data.useDefaultScene)
    {
      this.createGroundPlane()
      this.createBoundingCylinder()
    }


    this.defaultTarget.setAttribute('physx-body', 'type', 'static')

  },
  createGroundPlane() {
    let geometry = new PhysX.PxPlaneGeometry();
    // let geometry = new PhysX.PxBoxGeometry(10, 1, 10);
    let material = this.physics.createMaterial(0.8, 0.8, 0.1);

    const shape = this.physics.createShape(geometry, material, false, this.defaultActorFlags)
    shape.setQueryFilterData(this.defaultFilterData)
    shape.setSimulationFilterData(this.defaultFilterData)
        const transform = {
      translation: {
        x: 0,
        y: 0,
        z: -5,
      },
      rotation: {
        w: 0.707107, // PhysX uses WXYZ quaternions,
        x: 0,
        y: 0,
        z: 0.707107,
      },
    }
    let body = this.physics.createRigidStatic(transform)
    body.attachShape(shape)
    this.scene.addActor(body, null)
    this.ground = body
    this.rigidBody = body
  },
  createBoundingCylinder() {
    const numPlanes = 16
    let geometry = new PhysX.PxPlaneGeometry();
    let material = this.physics.createMaterial(0.1, 0.1, 0.8);
    let spherical = new THREE.Spherical();
    spherical.radius = 30;
    let quat = new THREE.Quaternion();
    let pos = new THREE.Vector3;
    let euler = new THREE.Euler();

    for (let i = 0; i < numPlanes; ++i)
    {
      spherical.theta = i * 2.0 * Math.PI / numPlanes;
      pos.setFromSphericalCoords(spherical.radius, spherical.theta, spherical.phi)
      pos.x = - pos.y
      pos.y = 0;
      euler.set(0, spherical.theta, 0);
      quat.setFromEuler(euler)

      const shape = this.physics.createShape(geometry, material, false, this.defaultActorFlags)
      shape.setQueryFilterData(this.defaultFilterData)
      shape.setSimulationFilterData(this.defaultFilterData)
      const transform = {
        translation: {
          x: pos.x,
          y: pos.y,
          z: pos.z,
        },
        rotation: {
          w: quat.w, // PhysX uses WXYZ quaternions,
          x: quat.x,
          y: quat.y,
          z: quat.z,
        },
      }
      let body = this.physics.createRigidStatic(transform)
      body.attachShape(shape)
      this.scene.addActor(body, null)
    }
  },
  async registerComponentBody(component, {type}) {
    await this.initializePhysX;

    // const shape = this.physics.createShape(geometry, material, false, flags)
    const transform = PhysXUtil.object3DPhysXTransform(component.el.object3D);

    let body
    if (type === 'dynamic' || type === 'kinematic')
    {
      body = this.physics.createRigidDynamic(transform)

      // body.setRigidBodyFlag(PhysX.PxRigidBodyFlag.eENABLE_CCD, true);
      // body.setMaxContactImpulse(1e2);
    }
    else
    {
      body = this.physics.createRigidStatic(transform)
    }
    for (let shape of component.createShapes(this.physics, this.defaultActorFlags))
    {
      body.attachShape(shape)
    }
    if (type === 'dynamic' || type === 'kinematic') {
      body.setMassAndUpdateInertia(component.data.mass)
    }
    this.scene.addActor(body, null)
    this.objects.set(component.el.object3D, body)
    component.rigidBody = body
  },
  registerShape(shape, component) {
    this.shapeMap.set(shape.$$.ptr, component);
  },
  tock(t, dt) {
    if (t < this.data.delay) return
    if (!this.physXInitialized && this.data.autoLoad && !this.running) this.startPhysX()
    if (!this.physXInitialized) return
    if (!this.running) return

    this.scene.simulate(THREE.Math.clamp(dt * this.data.speed / 1000, 0, 0.03 * this.data.speed), true)
    this.scene.fetchResults(true)

    for (let [obj, body] of this.objects)
    {
        const transform = body.getGlobalPose()
        this.worldHelper.position.copy(transform.translation);
        this.worldHelper.quaternion.copy(transform.rotation);
        obj.getWorldScale(this.worldHelper.scale)
        VARTISTE.Util.positionObject3DAtTarget(obj, this.worldHelper);
    }
  }
})

// Controls physics properties for individual shapes or rigid bodies. You can
// set this either on an entity with the `phyx-body` component, or on a shape or
// model contained in an entity with the `physx-body` component. If it's set on
// a `physx-body`, it will be the default material for all shapes in that body.
// If it's set on an element containing geometry or a model, it will be the
// material used for that shape only.
AFRAME.registerComponent('physx-material', {
  schema: {
    staticFriction: {default: 0.2},
    dynamicFriction: {default: 0.2},
    restitution: {default: 0.2},

    // Which collision layers this shape is present on
    collisionLayers: {default: [1], type: 'array'},
    // Array containing all layers that this shape should collide with
    collidesWithLayers: {default: [1,2,3,4], type: 'array'},

    // If >= 0, this will set the PhysX contact offset, indicating how far away
    // from the shape simulation contact events should begin.
    contactOffset: {default: -1.0},

    // If >= 0, this will set the PhysX rest offset
    restOffset: {default: -1.0},
  }
})

// Turns an entity into a PhysX rigid body. This is the main component for
// creating physics objects.
//
// **Types**
//
// There are 3 types of supported rigid bodies. The type can be set by using the
// `type` proeprty, but once initialized cannot be changed.
//
// - `dynamic` objects are objects that will have physics simulated on them. The
//   entity's world position, scale, and rotation will be used as the starting
//   condition for the simulation, however once the simulation starts the
//   entity's position and rotation will be replaced each frame with the results
//   of the simulation.
// - `static` objects are objects that cannot move. They cab be used to create
//   collidable objects for `dynamic` objects, or for anchor points for joints.
// - `kinematic` objects are objects that can be moved programmatically, but
//   will not be moved by the simulation. They can however, interact with and
//   collide with dynamic objects. Each frame, the entity's `object3D` will be
//   used to set the position and rotation for the simulation object.
//
// **Shapes**
//
// When the component is initialized, and on the `object3dset` event, all
// visible meshes that are descendents of this entity will have shapes created
// for them. Each individual mesh will have its own convex hull automatically
// generated for it. This means you can have reasonably accurate collision
// meshes both from building up shapes with a-frame geometry primitives, and
// from importing 3D models.
//
// Visible meshes can be excluded from this shape generation process by setting
// the `physx-no-collision` attribute on the corresponding `a-entity` element.
// Invisible meshes can be included into this shape generation process by
// settingt the `physx-hidden-collision` attribute on the corresponding
// `a-entity` element. This can be especially useful when using an external tool
// (like [Blender V-HACD](https://github.com/andyp123/blender_vhacd)) to create
// a low-poly convex collision mesh for a high-poly or concave mesh. This leads
// to this pattern for such cases:
//
// ```
//    <a-entity physx-body="type: dynamic">
//      <a-entity gltf-model="HighPolyOrConcaveURL.gltf" physx-no-collision=""></a-entity>
//      <a-entity gltf-model="LowPolyConvexURL.gltf" physx-hidden-collision="" visible="false"></a-entity>
//    </a-entity>
// ```
//
// Note, in such cases that if you are setting material properties on individual
// shapes, then the property should go on the collision mesh entity
//
// **Use with the [Manipulator](#manipulator) component**
//
// If a dynamic entity is grabbed by the [Manipulator](#manipulator) component,
// it will temporarily become a kinematic object. This means that collisions
// will no longer impede its movement, and it will track the manipulator
// exactly, (subject to any manipulator constraints, such as
// [`manipulator-weight`](#manipulator-weight)). If you would rather have the
// object remain dynamic, you will need to [redirect the grab](#redirect-grab)
// to a `physx-joint` instead, or even easier, use the
// [`dual-wieldable`](#dual-wieldable) component.
//
// As soon as the dynamic object is released, it will revert back to a dynamic
// object. Objects with the type `kinematic` will remain kinematic.
//
// Static objects should not be moved. If a static object can be the target of a
// manipulator grab, it should be `kinematic` instead.
AFRAME.registerComponent('physx-body', {
  dependencies: ['physx-material'],
  schema: {
    // **[dynamic, static, kinematic]** Type of the rigid body to create
    type: {default: 'dynamic', oneOf: ['dynamic', 'static', 'kinematic']},

    // Total mass of the body
    mass: {default: 1.0},

    // If > 0, will set the rigid body's angular damping
    angularDamping: {default: 0.0},

    // If > 0, will set the rigid body's linear damping
    linearDamping: {default: 0.0},

    // If set to `true`, it will emit `contactbegin` and `contactend` events
    // when collisions occur
    emitCollisionEvents: {default: false},

    // If set to `true`, the object will receive extra attention by the
    // simulation engine (at a performance cost).
    highPrecision: {default: false},
  },
  events: {
    stateadded: function(e) {
      if (e.detail === 'grabbed') {
        this.rigidBody.setRigidBodyFlag(PhysX.PxRigidBodyFlag.eKINEMATIC, true)
      }
    },
    stateremoved: function(e) {
      if (e.detail === 'grabbed') {
        if (this.floating) {
          this.rigidBody.setLinearVelocity({x: 0, y: 0, z: 0}, true)
        }
        if (this.data.type !== 'kinematic')
        {
          this.rigidBody.setRigidBodyFlag(PhysX.PxRigidBodyFlag.eKINEMATIC, false)
        }
      }
    },
    'bbuttonup': function(e) {
      this.toggleGravity()
    },
    object3dset: function(e) {
      if (this.rigidBody) {
        for (let shape of this.shapes)
        {
            this.rigidBody.detachShape(shape, false)
        }

        for (let shape of this.createShapes(this.system.physics))
        {
          this.rigidBody.attachShape(shape)
        }
      }
    },
    contactbegin: function(e) {
      // console.log("Collision", e.detail.points)
    }
  },
  init() {
    this.system = this.el.sceneEl.systems.physx
    this.physxRegisteredPromise = this.system.registerComponentBody(this, {type: this.data.type})
    this.el.setAttribute('grab-options', 'scalable', false)

    this.kinematicMove = this.kinematicMove.bind(this)
    this.el.sceneEl.systems['button-caster'].install(['bbutton'])
    if (this.el.sceneEl.systems.manipulator)
    {
        // this.el.sceneEl.systems.manipulator.installConstraint(this.kinematicMove)
    }

    this.physxRegisteredPromise.then(() => this.update())
  },
  update() {
    if (!this.rigidBody) return;

    if (this.data.type === 'dynamic')
    {
      this.rigidBody.setAngularDamping(this.data.angularDamping)
      this.rigidBody.setLinearDamping(this.data.linearDamping)
      if (this.data.highPrecision)
      {
        this.rigidBody.setSolverIterationCounts(4, 2);
        this.rigidBody.setRigidBodyFlag(PhysX.PxRigidBodyFlag.eENABLE_CCD, true)
      }
    }
  },
  createGeometry(o) {
    if (o.el.hasAttribute('geometry'))
    {
      let geometry = o.el.getAttribute('geometry');
      switch(geometry.primitive)
      {
        case 'sphere':
          return new PhysX.PxSphereGeometry(geometry.radius * this.el.object3D.scale.x * 0.98)
        case 'box':
          return new PhysX.PxBoxGeometry(geometry.width / 2, geometry.height / 2, geometry.depth / 2)
        default:
          return this.createConvexMeshGeometry(o.el.getObject3D('mesh'));
      }
    }
  },
  createConvexMeshGeometry(mesh, rootAncestor) {
    let vectors = new PhysX.PxVec3Vector()

    let g = mesh.geometry.attributes.position
    if (!g) return;
    let t = new THREE.Vector3;

    if (rootAncestor)
    {
      let matrix = new THREE.Matrix4();
      mesh.updateMatrix();
      matrix.copy(mesh.matrix)
      let ancestor = mesh.parent;
      while(ancestor && ancestor !== rootAncestor)
      {
          ancestor.updateMatrix();
          matrix.premultiply(ancestor.matrix);
          ancestor = ancestor.parent;
      }
      for (let i = 0; i < g.count; ++i) {
        t.fromBufferAttribute(g, i)
        t.applyMatrix4(matrix);
        vectors.push_back(Object.assign({}, t));
      }
    }
    else
    {
      for (let i = 0; i < g.count; ++i) {
        t.fromBufferAttribute(g, i)
        vectors.push_back(Object.assign({}, t));
      }
    }

    let worldScale = new THREE.Vector3;
    let worldBasis = (rootAncestor || mesh);
    worldBasis.updateMatrixWorld();
    worldBasis.getWorldScale(worldScale);
    let convexMesh = this.system.cooking.createConvexMesh(vectors, this.system.physics)
    return new PhysX.PxConvexMeshGeometry(convexMesh, new PhysX.PxMeshScale({x: worldScale.x, y: worldScale.y, z: worldScale.z}, {w: 1, x: 0, y: 0, z: 0}), new PhysX.PxConvexMeshGeometryFlags(PhysX.PxConvexMeshGeometryFlag.eTIGHT_BOUNDS.value))
  },
  createShape(physics, geometry, materialData)
  {
    let material = physics.createMaterial(materialData.staticFriction, materialData.dynamicFriction, materialData.restitution);
    let shape = physics.createShape(geometry, material, false, this.system.defaultActorFlags)
    shape.setQueryFilterData(new PhysX.PxFilterData(PhysXUtil.layersToMask(materialData.collisionLayers), PhysXUtil.layersToMask(materialData.collidesWithLayers), 0, 0))
    shape.setSimulationFilterData(this.system.defaultFilterData)

    if (materialData.contactOffset >= 0.0)
    {
      shape.setContactOffset(materialData.contactOffset)
    }
    if (materialData.restOffset >= 0.0)
    {
      shape.setRestOffset(materialData.restOffset)
    }

    this.system.registerShape(shape, this)

    return shape;
  },
  createShapes(physics) {
    if (this.el.hasAttribute('geometry'))
    {
      let geometry = this.createGeometry(this.el.object3D);
      if (!geometry) return;
      let materialData = this.el.components['physx-material'].data
      this.shapes = [this.createShape(physics, geometry, materialData)];

      return this.shapes;
    }

    let shapes = []
    this.el.object3D.traverse(o => {
      if (o.el && o.el.hasAttribute("physx-no-collision")) return;
      if (o.el && !o.el.object3D.visible && !o.el.hasAttribute("physx-hidden-collision")) return;
      if (o.geometry) {
        let geometry;
        if (false && o.el && o.el.hasAttribute('geometry'))
        {
          geometry = this.createGeometry(o);
        }
        else
        {
          geometry = this.createConvexMeshGeometry(o, this.el.object3D);
        }
        if (!geometry) {
          console.warn("Couldn't create geometry", o)
          return;
        }

        let material, materialData;
        if (o.el && o.el.hasAttribute('physx-material'))
        {
          materialData = o.el.getAttribute('physx-material')
        }
        else
        {
            materialData = this.el.components['physx-material'].data
        }
        let shape = this.createShape(physics, geometry, materialData)
        shapes.push(shape)
      }
    });

    this.shapes = shapes

    return shapes
    // return physics.createShape(geometry, material, false, flags)
  },
  // Turns gravity on and off
  toggleGravity() {
    this.rigidBody.setActorFlag(PhysX.PxActorFlag.eDISABLE_GRAVITY, !this.floating)
    this.floating = !this.floating
  },
  kinematicMove() {
    this.rigidBody.setKinematicTarget(PhysXUtil.object3DPhysXTransform(this.el.object3D))
  },
  tock(t, dt) {
    if (this.rigidBody && this.data.type === 'kinematic' && !this.setKinematic)
    {
      this.rigidBody.setRigidBodyFlag(PhysX.PxRigidBodyFlag.eKINEMATIC, true)
      this.setKinematic= true
    }
    if (this.el.is("grabbed")) {
      // this.el.object3D.scale.set(1,1,1)
      this.kinematicMove()
    }
  }
})

// Creates a PhysX joint between an ancestor rigid body and a target rigid body.
//
// The physx-joint is designed to be used either on or within an entity with the
// `physx-body` component. For instance:
//
// ```
// <a-entity physx-body="type: dynamic">
//   <a-entity physx-joint="target: #other-body" position="1 0 0"></a-entity>
// </a-entity>
// ```
//
// The position and rotation of the `physx-joint` will be used to create the
// corresponding PhysX joint object. Multiple joints can be created on a body,
// and multiple joints can target a body.
//
// **Note:** Constraints are not fully implemented yet. It is best to refer to
// the source code until work on constraints is completed to see what's
// supported.
AFRAME.registerComponent('physx-joint', {
  multiple: true,
  schema: {
    // Rigid body joint type to use. See the [NVIDIA PhysX joint
    // documentation](https://gameworksdocs.nvidia.com/PhysX/4.0/documentation/PhysXGuide/Manual/Joints.html)
    // for details on each type
    type: {default: "Spherical", oneOf: ["Fixed", "Spherical", "Distance", "Revolute", "Prismatic", "D6"]},

    // Target object. Must be an entity having the `physx-body` component
    target: {type: 'selector'},

    // NYI. Do not use
    softFixed: {default: false},

    // If true, constrains movement
    constrainToLimits: {default: false},

    // Constrains swinging movement. First element is the yAngle, second is
    // zAngle
    limitCone: {type: 'vec2'},

    // Limit twist. Vector components represent min and max angle
    limitTwist: {type: 'vec2'},

    // Limit linear movement. Vector components represent min and max distance
    limitX: {type: 'vec2'},
    // Limit linear movement. Vector components represent min and max distance
    limitY: {type: 'vec2'},
    // Limit linear movement. Vector components represent min and max distance
    limitZ: {type: 'vec2'},

    // Spring damping for soft constraints
    damping: {default: 0.0},
    // Spring restitution for soft constraints
    restitution: {default: 0.0},
    // If greater than 0, will make this joint a soft constraint, and use a
    // spring force model
    stiffness: {default: 0.0},
  },
  init() {
    this.system = this.el.sceneEl.systems.physx

    let parentEl = this.el

    while (parentEl && !parentEl.hasAttribute('physx-body'))
    {
        parentEl = parentEl.parentEl
    }

    if (!parentEl) {
      console.warn("physx-joint must be used within a physx-body")
      return;
    }

    this.bodyEl = parentEl

    this.worldHelper = new THREE.Object3D;
    this.worldHelperParent = new THREE.Object3D;
    this.el.sceneEl.object3D.add(this.worldHelperParent);
    this.targetScale = new THREE.Vector3(1,1,1)
    this.worldHelperParent.add(this.worldHelper)

    if (!this.data.target) {
      this.data.target = this.system.defaultTarget
    }


    VARTISTE.Util.whenLoaded([this.el, this.bodyEl, this.data.target], () => {
      this.createJoint()
    })
  },
  remove() {
    if (this.joint) {
      this.joint.release();
      this.joint = null;
    }
  },
  update() {
    if (!this.joint) return;

    switch (this.data.type)
    {
      case 'Spherical':
      {
        this.joint.setSphericalJointFlag(PhysX.PxSphericalJointFlag.eLIMIT_ENABLED, this.data.constrainToLimits)
        if (this.data.constrainToLimits)
        {
          let cone = new PhysX.PxJointLimitCone(this.data.limitCone.x, this.data.limitCone.y)
          cone.setDamping(this.data.damping)
          cone.setStiffness(this.data.stiffness)
          cone.setRestitution(this.data.restitution)
          this.joint.setLimitCone(cone);
        }
      }
      break;
      case 'D6':
      {
        let llimit = () => {
          let l = new PhysX.PxJointLinearLimitPair(new PhysX.PxTolerancesScale(), -0.01, 0.01);
          l.siffness = 0.9;
          return l
        }

        // this.joint.setMotion(PhysX.PxD6Axis.eX, PhysX.PxD6Motion.eLIMITED)
        // this.joint.setMotion(PhysX.PxD6Axis.eY, PhysX.PxD6Motion.eLIMITED)
        // this.joint.setMotion(PhysX.PxD6Axis.eZ, PhysX.PxD6Motion.eLIMITED)
        // this.joint.setLinearLimit(PhysX.PxD6Axis.eX, llimit())
        // this.joint.setLinearLimit(PhysX.PxD6Axis.eY, llimit())
        // this.joint.setLinearLimit(PhysX.PxD6Axis.eZ, llimit())

        if (this.data.limitCone.x > 0 && this.data.limitCone.y > 0)
        {
          this.joint.setMotion(PhysX.PxD6Axis.eSWING1, PhysX.PxD6Motion.eLIMITED)
          this.joint.setMotion(PhysX.PxD6Axis.eSWING2, PhysX.PxD6Motion.eLIMITED)

          let cone = new PhysX.PxJointLimitCone(this.data.limitCone.x, this.data.limitCone.y)
          cone.setDamping(this.data.damping)
          cone.setStiffness(this.data.stiffness)
          cone.setRestitution(this.data.restitution)
          this.joint.setSwingLimit(cone)
        }
        else if (this.data.limitCone.x < 0 && this.data.limitCone.y < 0)
        {
          this.joint.setMotion(PhysX.PxD6Axis.eSWING1, PhysX.PxD6Motion.eFREE)
          this.joint.setMotion(PhysX.PxD6Axis.eSWING2, PhysX.PxD6Motion.eFREE)
        }
        else
        {
          this.joint.setMotion(PhysX.PxD6Axis.eSWING1, PhysX.PxD6Motion.eLOCKED)
          this.joint.setMotion(PhysX.PxD6Axis.eSWING2, PhysX.PxD6Motion.eLOCKED)
        }

        if (this.data.limitTwist.x !== 0 && this.data.limitTwist.y !== 0)
        {
          this.joint.setMotion(PhysX.PxD6Axis.eTWIST, PhysX.PxD6Motion.eLIMITED)
          this.joint.setTwistLimit(new PhysX.PxJointAngularLimitPair(this.data.limitTwist.x, this.data.limitTwist.y))
        }
        else
        {
          this.joint.setMotion(PhysX.PxD6Axis.eTWIST, PhysX.PxD6Motion.eLOCKED)
        }
      }
      break;
    }
  },
  getTransform(el) {
    VARTISTE.Util.positionObject3DAtTarget(this.worldHelperParent, el.object3D, {scale: this.targetScale})

    VARTISTE.Util.positionObject3DAtTarget(this.worldHelper, this.el.object3D, {scale: this.targetScale});

    let transform = PhysXUtil.matrixToTransform(this.worldHelper.matrix);

    return transform;
  },
  async createJoint() {
    await this.bodyEl.components['physx-body'].physxRegisteredPromise;
    await this.data.target.components['physx-body'].physxRegisteredPromise;

    if (this.joint) {
      this.joint.release();
      this.joint = null;
    }

    let thisTransform = this.getTransform(this.bodyEl);
    let targetTransform = this.getTransform(this.data.target);

    this.joint = PhysX[`Px${this.data.type}JointCreate`](this.system.physics,
                                                         this.bodyEl.components['physx-body'].rigidBody, thisTransform,
                                                         this.data.target.components['physx-body'].rigidBody, targetTransform,
                                                        )
    this.update();
  }
})

// Allows a dynamic object to be manipulated by more than one manipulator at
// once (e.g., by both hands). The object should have the `clickable` class, or
// clickable descendents should have the `propogate-grab` attribute set. Joints
// will automatically be created and destroyed at grab sites, and will use
// "wobbly sword" physics constraints.
//
// This is the easiest way to create non-kinematic grabbing.
AFRAME.registerComponent('dual-wieldable', {
  init() {
    let target = document.createElement('a-entity')
    this.el.parentEl.append(target)

    if (this.el.hasAttribute('manipulator-weight'))
    {
      target.setAttribute('manipulator-weight', this.el.getAttribute('manipulator-weight'))
    }

    target.setAttribute('dual-wield-target', {target: this.el})
    this.el.setAttribute('redirect-grab', target)
    this.el.classList.add('grab-root')
  }
})

// Helper component for facilitating [`dual-wieldable`](#dual-wieldable)
AFRAME.registerComponent('dual-wield-target', {
  schema: {
    numberOfJoints: {default: 2},
    target: {type: 'selector'},
  },
  events: {
    stateadded: function(e) {
      if (e.detail === 'grabbed')
      {
        this.el['redirect-grab'] = this.joints.find(j => !j.is("grabbed")) || this.nullTarget

        let el = VARTISTE.Util.resolveGrabRedirection(e.target);
        if (el === this.nullTarget) {
          console.warn("Used up all dual-wield-targets. not grabbing.")
          return;
        }
        console.log("starting dual grab target for", e, el)
        let rigidBody = el.components['physx-body'].rigidBody;

        // TODO: Fix order of state and grabbing manipulator in VARTISTE
        VARTISTE.Util.callLater(() => {
          let manipulator = el.grabbingManipulator;
          console.log("manipulator", manipulator)

          manipulator.offset.set(0, 0, 0)
          VARTISTE.Util.positionObject3DAtTarget(el.object3D, manipulator.endPoint)

          el.setAttribute('physx-joint', {type: 'D6', target: this.data.target,
                                          limitCone: {x: 0.004, y: 0.004},
                                          stiffness: 100, damping: 100, restitution: 0,
                                          limitTwist: {x: -0.04, y: 0.04},
                                         })
          this.updateHandParameters();
        })
      }
    },
    stateremoved: function(e) {
      if (e.detail === 'grabbed')
      {
        let el = e.target
        console.log("Ending dual wield", el)
        el.removeAttribute('physx-joint')

        this.el['redirect-grab'] = this.joints.find(j => !j.is("grabbed")) || this.nullTarget

        this.updateHandParameters();
      }
    }
  },
  init() {
    this.jointMap = new Map();
    this.joints = []
    for (let i = 0; i < this.data.numberOfJoints; ++i)
    {
      let joint = document.createElement('a-entity')
      this.el.append(joint)
      joint.classList.add("dual-wield-joint");
      joint.setAttribute('physx-material', 'collidesWithLayers: 0; collisionLayers: 0')
      joint.setAttribute('physx-body', 'type: kinematic')

      if (this.el.hasAttribute('manipulator-weight'))
      {
        joint.setAttribute('manipulator-weight', this.el.getAttribute('manipulator-weight'))
      }

      // let vis = document.createElement('a-entity')
      // joint.append(vis)
      // vis.setAttribute('geometry', 'primitive: sphere; radius: 0.05')
      // vis.setAttribute('physx-no-collision')
      this.joints.push(joint)
    }
    this.el['redirect-grab'] = this.joints[0]

    let nullTarget = document.createElement('a-entity')
    this.el.append(nullTarget)
    this.nullTarget = nullTarget
  },
  updateHandParameters() {
    let grabbedCount = 0
    for (let joint of this.joints)
    {
        if (joint.hasAttribute('physx-joint')) grabbedCount++;
    }
    if (grabbedCount === 1)
    {
      this.setSingleHandParameters()
    }
    else if (grabbedCount > 1)
    {
      this.setMultiHandParameters()
    }
  },
  setSingleHandParameters() {
    for (let joint of this.joints)
    {
      if (joint.hasAttribute('physx-joint'))
      {
          joint.setAttribute('physx-joint', {type: 'D6', target: this.data.target,
                                  limitCone: {x: 0.001, y: 0.001},
                                  stiffness: 1000, damping: 100, restitution: 0,
                                  limitTwist: {x: 0, y: 0},
                                 })
      }
    }
  },
  setMultiHandParameters() {
    for (let joint of this.joints)
    {
      if (joint.hasAttribute('physx-joint'))
      {
          joint.setAttribute('physx-joint', {type: 'D6', target: this.data.target,
                                  limitCone: {x: Math.PI/2, y: Math.PI/2},
                                  stiffness: 0.5, damping: 1, restitution: 0,
                                  limitTwist: {x: -Math.PI/2, y: Math.PI/2},
                                 })
      }
    }
  }
})

AFRAME.registerSystem('contact-sound', {
  init() {
    this.worldHelper = new THREE.Object3D;
    this.el.sceneEl.object3D.add(this.worldHelper)
  }
})

// Plays a sound when a `physx-body` has a collision.
AFRAME.registerComponent('contact-sound', {
  dependencies: ['physx-body'],
  schema: {
    // Sound file location or asset
    src: {type: 'string'},

    // Minimum total impulse to play the sound
    impulseThreshold: {default: 0.01},

    // NYI
    maxDistance: {default: 10.0},
    // NYI
    maxDuration: {default: 5.0},

    // Delay after start of scene before playing sounds. Useful to avoid a
    // zillion sounds playing as objects initially settle on the ground
    startDelay: {default: 6000},

    // If `true`, the sound will be positioned at the weighted averaged location
    // of all contact points. Contact points are weighted by impulse amplitude.
    // If `false`, the sound will be positioned at the entity's origin.
    positionAtContact: {default: false},
  },
  events: {
    contactbegin: function(e) {
      if (this.el.sceneEl.time < this.data.startDelay) return
      let thisWorld = this.pool('thisWorld', THREE.Vector3);
      let cameraWorld = this.pool('cameraWorld', THREE.Vector3);

      let impulses = e.detail.impulses
      let impulseSum = 0
      for (let i = 0; i < impulses.size(); ++i)
      {
        impulseSum += impulses.get(i)
      }

      if (impulseSum < this.data.impulseThreshold) return;

      thisWorld.set(0, 0, 0)
      let impulse = 0.0;
      if (this.data.positionAtContact)
      {
        for (let i = 0; i < impulses.size(); ++i)
        {
          impulse = impulses.get(i);
          let position = e.detail.points.get(i);
          thisWorld.x += position.x * impulse;
          thisWorld.y += position.y * impulse;
          thisWorld.z += position.z * impulse;
        }
        thisWorld.multiplyScalar(1.0 / impulseSum)
        this.system.worldHelper.position.copy(thisWorld)
        VARTISTE.Util.positionObject3DAtTarget(this.sound.object3D, this.system.worldHelper)
      }

      this.sound.components.sound.stopSound();
      this.sound.components.sound.playSound();
    },
  },
  init() {
    VARTISTE.Pool.init(this)

    let sound = document.createElement('a-entity')
    this.el.append(sound)
    sound.setAttribute('sound', {src: this.data.src})
    this.sound = sound

    // if (this.data.positionAtContact) sound.setAttribute('geometry', 'primitive: sphere; radius: 0.1')

    this.el.setAttribute('physx-body', 'emitCollisionEvents', true)
  }
})
