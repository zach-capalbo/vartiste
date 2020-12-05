const utils = AFRAME.utils
const {Util} = require('./util.js')
const {THREED_MODES} = require('./layer-modes.js')

updateMatcapMap = function (shader, data) {
  var longType = 'matcap';
  var shortType = longType;
  var el = shader.el;
  var material = shader.material;
  var rendererSystem = el.sceneEl.systems.renderer;
  var src = data[longType];
  var info = {};
  info.src = src;

  // Pass through the repeat and offset to be handled by the material loader.
  info.offset = data[longType + 'TextureOffset'];
  info.repeat = data[longType + 'TextureRepeat'];
  info.wrap = data[longType + 'TextureWrap'];

  if (src) {
    if (src === shader[longType + 'TextureSrc']) { return; }

    // Texture added or changed.
    shader[longType + 'TextureSrc'] = src;
    el.sceneEl.systems.material.loadTexture(src, info, setMap);
    return;
  }

  // Texture removed.
  if (!material.map) { return; }
  setMap(null);

  function setMap (texture) {
    var slot = shortType;
    material[slot] = texture;
    if (texture) {
      // rendererSystem.applyColorCorrection(texture);
    }
    material.needsUpdate = true;
    utils.material.handleTextureEvents(el, texture);
  }
};

// Wraps a [THREE.MeshMatcapMaterial](https://threejs.org/docs/#api/en/materials/MeshMatcapMaterial)
AFRAME.registerShader('matcap', {
  schema: {
    color: {type: 'color'},

    displacementMap: {type: 'map'},
    displacementScale: {default: 1},
    displacementBias: {default: 0.5},
    displacementTextureOffset: {type: 'vec2'},
    displacementTextureRepeat: {type: 'vec2', default: {x: 1, y: 1}},

    fog: {default: true},
    height: {default: 256},

    normalMap: {type: 'map'},
    normalScale: {type: 'vec2', default: {x: 1, y: 1}},
    normalTextureOffset: {type: 'vec2'},
    normalTextureRepeat: {type: 'vec2', default: {x: 1, y: 1}},

    offset: {type: 'vec2', default: {x: 0, y: 0}},
    repeat: {type: 'vec2', default: {x: 1, y: 1}},

    src: {type: 'map'},
    matcap: {type: 'map', default: '#asset-matcap'},
    width: {default: 512},
    wireframe: {default: false},
    wireframeLinewidth: {default: 2}
  },

  /**
   * Initializes the shader.
   * Adds a reference from the scene to this entity as the camera.
   */
  init: function (data) {
    this.rendererSystem = this.el.sceneEl.systems.renderer;
    this.materialData = {color: new THREE.Color()};
    getMaterialData(data, this.materialData);
    this.rendererSystem.applyColorCorrection(this.materialData.color);
    this.rendererSystem.applyColorCorrection(this.materialData.emissive);
    this.material = new THREE.MeshMatcapMaterial(this.materialData);

    utils.material.updateMap(this, data);
    if (data.normalMap) { utils.material.updateDistortionMap('normal', this, data); }
    if (data.displacementMap) { utils.material.updateDistortionMap('displacement', this, data); }
    if (data.matcap) { utils.material.updateDistortionMap('matcap', this, data); }
  },

  update: function (data) {
    this.updateMaterial(data);
    utils.material.updateMap(this, data);
    if (data.normalMap) { utils.material.updateDistortionMap('normal', this, data); }
    if (data.displacementMap) { utils.material.updateDistortionMap('displacement', this, data); }
    if (data.matcap) { updateMatcapMap(this, data); }
  },

  /**
   * Updating existing material.
   *
   * @param {object} data - Material component data.
   * @returns {object} Material.
   */
  updateMaterial: function (data) {
    var key;
    var material = this.material;
    getMaterialData(data, this.materialData);
    this.rendererSystem.applyColorCorrection(this.materialData.color);
    for (key in this.materialData) {
      material[key] = this.materialData[key];
    }
  },
});

/**
 * Builds and normalize material data, normalizing stuff along the way.
 *
 * @param {object} data - Material data.
 * @param {object} materialData - Object to use.
 * @returns {object} Updated materialData.
 */
function getMaterialData (data, materialData) {
  materialData.color.set(data.color);

  materialData.fog = data.fog;

  materialData.wireframe = data.wireframe;
  materialData.wireframeLinewidth = data.wireframeLinewidth;

  if (data.normalMap) { materialData.normalScale = data.normalScale; }

  if (data.displacementMap) {
    materialData.displacementScale = data.displacementScale;
    materialData.displacementBias = data.displacementBias;
  }

  return materialData;
}

// Applies this element's
// [`material`](https://aframe.io/docs/1.0.0/components/material.html) component
// material to any mesh that gets set for the element. Useful, for instance, for
// replacing the material on a
// [`gltf-model`](https://aframe.io/docs/1.0.0/components/gltf-model.html)
AFRAME.registerComponent('apply-material-to-mesh', {
  dependencies: ['material'],
  init() {
    Util.whenLoaded(this.el, () => this.applyMaterial())
    this.el.addEventListener('object3dset', (e) => {
      this.applyMaterial()
    })
    this.el.addEventListener('componentchanged', (e) => {
      if (e.detail === 'material')
      {
        this.applyMaterial()
      }
    })
  },
  applyMaterial(mesh = undefined)
  {
    if (!this.el.hasAttribute('material')) return
    if (!mesh) mesh = this.el.getObject3D('mesh')

  if (!mesh) return


    let material = this.el.components.material.material

    mesh.traverse(o => {
      if (o.material)
      {
        o.material = material
      }
    })
  }
})

const textureModes = ["map"].concat(THREED_MODES)

// Allows scrolling of a mesh's UV coordinates. Can be used to create animated
// materials. Based on the Mozilla Hubs [uv-scroll](https://github.com/mozilla/hubs/blob/master/src/components/uv-scroll.js)
// component.
AFRAME.registerComponent('uv-scroll', {
  schema: {
    // If true, any data found in `MOZ_hubs_components` GLTF extension
    // `uv-scroll` data will overide parameters set in this component
    useGltfExtensionData: {default: true},

    // If true, this will only apply the uv scrolling effect to models which
    // have been loaded with the `MOZ_hubs_components` GLTF extension with
    // `uv-scroll` data. (i.e., the
    // `mesh.userData.gltfExtensions.MOZ_hubs_components` is set)
    requireGltfExtension: {default: false},

    // Speed at which to scroll in each direction
    speed: {type: 'vec2'},

    // Increment to scroll in each direction. If greater than zero, uv steps
    // will be quantized to this amount.
    increment: {type: 'vec2'},
  },
  events: {
    object3dset: function(e) {
      if (e.detail === 'mesh')
      {
        this.resetObjectList()
      }
    },
    "model-loaded": function() {
      this.resetObjectList()
    }
  },
  init() {
    this.offset = new THREE.Vector2()
    this.tick = AFRAME.utils.throttleTick(this.tick, 10, this)
    this.objs = []

    if (this.el.getObject3D('mesh')) this.resetObjectList()
  },
  resetObjectList() {
    this.objs = []
    this.el.getObject3D('mesh').traverse(o => {
      if (o.material) {
        if (this.data.useGltfExtensionData && o.userData && o.userData.gltfExtensions && o.userData.gltfExtensions.MOZ_hubs_components && o.userData.gltfExtensions.MOZ_hubs_components['uv-scroll'])
        {
          this.objs.push(o)
          this.data.speed.x = o.userData.gltfExtensions.MOZ_hubs_components['uv-scroll'].speed.x
          this.data.speed.y = o.userData.gltfExtensions.MOZ_hubs_components['uv-scroll'].speed.y
          this.data.increment.x = o.userData.gltfExtensions.MOZ_hubs_components['uv-scroll'].increment.x
          this.data.increment.y = o.userData.gltfExtensions.MOZ_hubs_components['uv-scroll'].increment.y
        }
        else if (!this.data.requireGltfExtension)
        {
          this.objs.push(o)
        }
      }
    })
  },
  tick(t, dt) {
    //Based on the Mozilla Hubs [uv-scroll](https://github.com/mozilla/hubs/blob/master/src/components/uv-scroll.js)
    // component.
    if (this.objs.length === 0) return
    this.offset.addScaledVector(this.data.speed, dt / 1000);

    this.offset.x = this.offset.x % 1.0;
    this.offset.y = this.offset.y % 1.0;

    for (let o of this.objs)
    {
      for (let map of textureModes)
      {
        if (!o.material[map]) return
        o.material[map].offset.x = this.data.increment.x ? this.offset.x - (this.offset.x % this.data.increment.x) : this.offset.x;
        o.material[map].offset.y = this.data.increment.y ? this.offset.y - (this.offset.y % this.data.increment.y) : this.offset.y;
      }
    }
  }
})
