const utils = AFRAME.utils

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
    console.log("Matcap", data.matcap)
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
