import {Util} from './util.js'
import {BufferGeometryUtils} from './framework/BufferGeometryUtils.js'

class GeometryHelper {
  fromMesh(name, mesh = undefined) {
    if (!mesh) mesh = Compositor.mesh;

    return `
AFRAME.registerGeometry("${name}", {
  init: function()
})
`
  }
}

Util.GeometryHelper = new GeometryHelper();

const unwrappedUvs = [0.3333333432674408, 1, 0.3333333432674408, 0.5, 0, 1, 0, 0.5, 0, 0.5, 0, 0, 0.3333333432674408, 0.5, 0.3333333432674408, 0, 0.6666666865348816, 0.5, 0.6666666865348816, 1, 1, 0.5, 1, 1, 0.6666666865348816, 0.5, 0.6666666865348816, 0, 1, 0.5, 1, 0, 0.3333333432674408, 1, 0.3333333432674408, 0.5, 0.6666666865348816, 1, 0.6666666865348816, 0.5, 0.6666666865348816, 0.5, 0.6666666865348816, 0, 0.3333333432674408, 0.5, 0.3333333432674408, 0];

AFRAME.registerGeometry('unwrapped-box', {
  schema: {
    depth: {default: 1, min: 0},
    height: {default: 1, min: 0},
    width: {default: 1, min: 0},
    segmentsHeight: {default: 1, min: 1, max: 20, type: 'int'},
    segmentsWidth: {default: 1, min: 1, max: 20, type: 'int'},
    segmentsDepth: {default: 1, min: 1, max: 20, type: 'int'}
  },

  init: function (data) {
    this.geometry = new THREE.BoxGeometry(data.width, data.height, data.depth);
    this.geometry.attributes.uv.array.set(unwrappedUvs)
    this.geometry.attributes.uv.needsUpdate = true
  }
});

const unwrappedDDHUvs = [0.21268180012702942,0.4651528000831604,0.03430339694023132,0.49899470806121826,0.25464415550231934,0.5970472693443298,0.25464415550231934,0.5970472693443298,0.3592928349971771,0.631489634513855,0.3775893449783325,0.3899824619293213,0.21268180012702942,0.4651528000831604,0.25464415550231934,0.5970472693443298,0.3775893449783325,0.3899824619293213,0.7744530439376831,0.5383695363998413,0.9514352083206177,0.5026180744171143,0.7348358035087585,0.40447157621383667,0.25464415550231934,0.5970472693443298,0.20506173372268677,0.6873689889907837,0.3592928349971771,0.631489634513855,0.3592928349971771,0.631489634513855,0.4687690734863281,0.5471002459526062,0.3775893449783325,0.3899824619293213,0.3592928349971771,0.631489634513855,0.3667108714580536,0.7432601451873779,0.593855619430542,0.6740357875823975,0.4687690734863281,0.5471002459526062,0.3592928349971771,0.631489634513855,0.593855619430542,0.6740357875823975,0.3667108714580536,0.7432601451873779,0.48051005601882935,0.8121715784072876,0.593855619430542,0.6740357875823975,0.20506173372268677,0.6873689889907837,0.26267555356025696,0.77445387840271,0.3592928349971771,0.631489634513855,0.9514352083206177,0.5026180744171143,0.9446355104446411,0.3078967332839966,0.7348358035087585,0.40447157621383667,0.9446355104446411,0.3078967332839966,0.7814126014709473,0.3167771100997925,0.7348358035087585,0.40447157621383667,0.4100990891456604,0.964766263961792,0.48051005601882935,0.8121715784072876,0.3667108714580536,0.7432601451873779,0.26267555356025696,0.77445387840271,0.3667108714580536,0.7432601451873779,0.3592928349971771,0.631489634513855,0.5350462198257446,0.46299028396606445,0.6171379089355469,0.596663236618042,0.6322877407073975,0.3837354779243469,0.6171379089355469,0.596663236618042,0.7744530439376831,0.5383695363998413,0.6322877407073975,0.3837354779243469,0.6322877407073975,0.3837354779243469,0.6341436505317688,0.2802274823188782,0.5141092538833618,0.2168075442314148,0.5350462198257446,0.46299028396606445,0.6322877407073975,0.3837354779243469,0.5141092538833618,0.2168075442314148,0.7744530439376831,0.5383695363998413,0.7348358035087585,0.40447157621383667,0.6322877407073975,0.3837354779243469,0.6322877407073975,0.3837354779243469,0.7348358035087585,0.40447157621383667,0.6341436505317688,0.2802274823188782,0.03430339694023132,0.6955721378326416,0.045912206172943115,0.9005166888237,0.26267555356025696,0.77445387840271,0.20506173372268677,0.6873689889907837,0.03430339694023132,0.6955721378326416,0.26267555356025696,0.77445387840271,0.43514642119407654,0.3475046753883362,0.5350462198257446,0.46299028396606445,0.5141092538833618,0.2168075442314148,0.03430339694023132,0.49899470806121826,0.03430339694023132,0.6955721378326416,0.25464415550231934,0.5970472693443298,0.03430339694023132,0.6955721378326416,0.20506173372268677,0.6873689889907837,0.25464415550231934,0.5970472693443298,0.7814126014709473,0.3167771100997925,0.726246178150177,0.23727422952651978,0.6341436505317688,0.2802274823188782,0.7814126014709473,0.3167771100997925,0.9446355104446411,0.3078967332839966,0.726246178150177,0.23727422952651978,0.9446355104446411,0.3078967332839966,0.9256163835525513,0.11961370706558228,0.726246178150177,0.23727422952651978,0.9256163835525513,0.11961370706558228,0.7512683868408203,0.10573208332061768,0.726246178150177,0.23727422952651978,0.7348358035087585,0.40447157621383667,0.7814126014709473,0.3167771100997925,0.6341436505317688,0.2802274823188782,0.045912206172943115,0.9005166888237,0.2354159653186798,0.9200700521469116,0.26267555356025696,0.77445387840271,0.726246178150177,0.23727422952651978,0.7512683868408203,0.10573208332061768,0.5810382962226868,0.05175662040710449,0.6341436505317688,0.2802274823188782,0.726246178150177,0.23727422952651978,0.5810382962226868,0.05175662040710449,0.26267555356025696,0.77445387840271,0.2354159653186798,0.9200700521469116,0.3667108714580536,0.7432601451873779,0.5141092538833618,0.2168075442314148,0.6341436505317688,0.2802274823188782,0.5810382962226868,0.05175662040710449,0.2354159653186798,0.9200700521469116,0.4100990891456604,0.964766263961792,0.3667108714580536,0.7432601451873779]
const unwrappedDDHpos = [-0.17841105163097382,-0.46708616614341736,0,0.17841105163097382,-0.46708616614341736,0,-0.28867512941360474,-0.28867512941360474,0.28867512941360474,-0.28867512941360474,-0.28867512941360474,0.28867512941360474,-0.46708616614341736,0,0.17841105163097382,-0.28867512941360474,-0.28867512941360474,-0.28867512941360474,-0.17841105163097382,-0.46708616614341736,0,-0.28867512941360474,-0.28867512941360474,0.28867512941360474,-0.28867512941360474,-0.28867512941360474,-0.28867512941360474,-0.28867512941360474,-0.28867512941360474,-0.28867512941360474,-0.46708616614341736,0,-0.17841105163097382,0,-0.17841105163097382,-0.46708616614341736,-0.28867512941360474,-0.28867512941360474,0.28867512941360474,0,-0.17841105163097382,0.46708616614341736,-0.46708616614341736,0,0.17841105163097382,-0.46708616614341736,0,0.17841105163097382,-0.46708616614341736,0,-0.17841105163097382,-0.28867512941360474,-0.28867512941360474,-0.28867512941360474,-0.46708616614341736,0,0.17841105163097382,-0.28867512941360474,0.28867512941360474,0.28867512941360474,-0.28867512941360474,0.28867512941360474,-0.28867512941360474,-0.46708616614341736,0,-0.17841105163097382,-0.46708616614341736,0,0.17841105163097382,-0.28867512941360474,0.28867512941360474,-0.28867512941360474,-0.28867512941360474,0.28867512941360474,0.28867512941360474,-0.17841105163097382,0.46708616614341736,0,-0.28867512941360474,0.28867512941360474,-0.28867512941360474,0,-0.17841105163097382,0.46708616614341736,0,0.17841105163097382,0.46708616614341736,-0.46708616614341736,0,0.17841105163097382,-0.46708616614341736,0,-0.17841105163097382,-0.28867512941360474,0.28867512941360474,-0.28867512941360474,0,-0.17841105163097382,-0.46708616614341736,-0.28867512941360474,0.28867512941360474,-0.28867512941360474,0,0.17841105163097382,-0.46708616614341736,0,-0.17841105163097382,-0.46708616614341736,0.17841105163097382,0.46708616614341736,0,-0.17841105163097382,0.46708616614341736,0,-0.28867512941360474,0.28867512941360474,0.28867512941360474,0,0.17841105163097382,0.46708616614341736,-0.28867512941360474,0.28867512941360474,0.28867512941360474,-0.46708616614341736,0,0.17841105163097382,0.17841105163097382,-0.46708616614341736,0,-0.17841105163097382,-0.46708616614341736,0,0.28867512941360474,-0.28867512941360474,-0.28867512941360474,-0.17841105163097382,-0.46708616614341736,0,-0.28867512941360474,-0.28867512941360474,-0.28867512941360474,0.28867512941360474,-0.28867512941360474,-0.28867512941360474,0.28867512941360474,-0.28867512941360474,-0.28867512941360474,0.46708616614341736,0,-0.17841105163097382,0.46708616614341736,0,0.17841105163097382,0.17841105163097382,-0.46708616614341736,0,0.28867512941360474,-0.28867512941360474,-0.28867512941360474,0.46708616614341736,0,0.17841105163097382,-0.28867512941360474,-0.28867512941360474,-0.28867512941360474,0,-0.17841105163097382,-0.46708616614341736,0.28867512941360474,-0.28867512941360474,-0.28867512941360474,0.28867512941360474,-0.28867512941360474,-0.28867512941360474,0,-0.17841105163097382,-0.46708616614341736,0.46708616614341736,0,-0.17841105163097382,0.28867512941360474,-0.28867512941360474,0.28867512941360474,0.46708616614341736,0,0.17841105163097382,0,0.17841105163097382,0.46708616614341736,0,-0.17841105163097382,0.46708616614341736,0.28867512941360474,-0.28867512941360474,0.28867512941360474,0,0.17841105163097382,0.46708616614341736,0.28867512941360474,-0.28867512941360474,0.28867512941360474,0.17841105163097382,-0.46708616614341736,0,0.46708616614341736,0,0.17841105163097382,0.17841105163097382,-0.46708616614341736,0,0.28867512941360474,-0.28867512941360474,0.28867512941360474,-0.28867512941360474,-0.28867512941360474,0.28867512941360474,0.28867512941360474,-0.28867512941360474,0.28867512941360474,0,-0.17841105163097382,0.46708616614341736,-0.28867512941360474,-0.28867512941360474,0.28867512941360474,0,0.17841105163097382,-0.46708616614341736,0.28867512941360474,0.28867512941360474,-0.28867512941360474,0.46708616614341736,0,-0.17841105163097382,0,0.17841105163097382,-0.46708616614341736,-0.28867512941360474,0.28867512941360474,-0.28867512941360474,0.28867512941360474,0.28867512941360474,-0.28867512941360474,-0.28867512941360474,0.28867512941360474,-0.28867512941360474,-0.17841105163097382,0.46708616614341736,0,0.28867512941360474,0.28867512941360474,-0.28867512941360474,-0.17841105163097382,0.46708616614341736,0,0.17841105163097382,0.46708616614341736,0,0.28867512941360474,0.28867512941360474,-0.28867512941360474,0,-0.17841105163097382,-0.46708616614341736,0,0.17841105163097382,-0.46708616614341736,0.46708616614341736,0,-0.17841105163097382,0.46708616614341736,0,0.17841105163097382,0.28867512941360474,0.28867512941360474,0.28867512941360474,0,0.17841105163097382,0.46708616614341736,0.28867512941360474,0.28867512941360474,-0.28867512941360474,0.17841105163097382,0.46708616614341736,0,0.28867512941360474,0.28867512941360474,0.28867512941360474,0.46708616614341736,0,-0.17841105163097382,0.28867512941360474,0.28867512941360474,-0.28867512941360474,0.28867512941360474,0.28867512941360474,0.28867512941360474,0,0.17841105163097382,0.46708616614341736,0.28867512941360474,0.28867512941360474,0.28867512941360474,-0.28867512941360474,0.28867512941360474,0.28867512941360474,0.46708616614341736,0,0.17841105163097382,0.46708616614341736,0,-0.17841105163097382,0.28867512941360474,0.28867512941360474,0.28867512941360474,0.28867512941360474,0.28867512941360474,0.28867512941360474,0.17841105163097382,0.46708616614341736,0,-0.28867512941360474,0.28867512941360474,0.28867512941360474]
const unwrappedDDHNorm = [0,-0.8506508469581604,0.5257311463356018,0,-0.8506508469581604,0.5257311463356018,0,-0.8506508469581604,0.5257311463356018,-0.8506507873535156,-0.5257311463356018,0,-0.8506507873535156,-0.5257311463356018,0,-0.8506507873535156,-0.5257311463356018,0,-0.8506507277488708,-0.525731086730957,0,-0.8506507277488708,-0.525731086730957,0,-0.8506507277488708,-0.525731086730957,0,-0.525731086730957,0,-0.8506507873535156,-0.525731086730957,0,-0.8506507873535156,-0.525731086730957,0,-0.8506507873535156,-0.525731086730957,0,0.8506507873535156,-0.525731086730957,0,0.8506507873535156,-0.525731086730957,0,0.8506507873535156,-0.8506508469581604,-0.5257311463356018,0,-0.8506508469581604,-0.5257311463356018,0,-0.8506508469581604,-0.5257311463356018,0,-0.8506507873535156,0.5257311463356018,0,-0.8506507873535156,0.5257311463356018,0,-0.8506507873535156,0.5257311463356018,0,-0.8506508469581604,0.5257311463356018,0,-0.8506508469581604,0.5257311463356018,0,-0.8506508469581604,0.5257311463356018,0,-0.8506507277488708,0.525731086730957,0,-0.8506507277488708,0.525731086730957,0,-0.8506507277488708,0.525731086730957,0,-0.5257311463356018,0,0.8506507873535156,-0.5257311463356018,0,0.8506507873535156,-0.5257311463356018,0,0.8506507873535156,-0.525731086730957,0,-0.8506507873535156,-0.525731086730957,0,-0.8506507873535156,-0.525731086730957,0,-0.8506507873535156,-0.5257311463356018,0,-0.8506508469581604,-0.5257311463356018,0,-0.8506508469581604,-0.5257311463356018,0,-0.8506508469581604,0,0.8506508469581604,0.5257311463356018,0,0.8506508469581604,0.5257311463356018,0,0.8506508469581604,0.5257311463356018,-0.525731086730957,6.152907161549592e-8,0.8506507277488708,-0.525731086730957,6.152907161549592e-8,0.8506507277488708,-0.525731086730957,6.152907161549592e-8,0.8506507277488708,0,-0.8506508469581604,-0.5257311463356018,0,-0.8506508469581604,-0.5257311463356018,0,-0.8506508469581604,-0.5257311463356018,0,-0.8506507873535156,-0.5257311463356018,0,-0.8506507873535156,-0.5257311463356018,0,-0.8506507873535156,-0.5257311463356018,0.8506508469581604,-0.5257311463356018,0,0.8506508469581604,-0.5257311463356018,0,0.8506508469581604,-0.5257311463356018,0,0.8506507873535156,-0.525731086730957,0,0.8506507873535156,-0.525731086730957,0,0.8506507873535156,-0.525731086730957,0,0,-0.8506507277488708,-0.525731086730957,0,-0.8506507277488708,-0.525731086730957,0,-0.8506507277488708,-0.525731086730957,0.525731086730957,0,-0.8506507873535156,0.525731086730957,0,-0.8506507873535156,0.525731086730957,0,-0.8506507873535156,0.5257311463356018,0,0.8506507873535156,0.5257311463356018,0,0.8506507873535156,0.5257311463356018,0,0.8506507873535156,0.5257311463356018,0,0.8506508469581604,0.5257311463356018,0,0.8506508469581604,0.5257311463356018,0,0.8506508469581604,0.8506507873535156,-0.525731086730957,0,0.8506507873535156,-0.525731086730957,0,0.8506507873535156,-0.525731086730957,0,0,-0.8506507873535156,0.5257311463356018,0,-0.8506507873535156,0.5257311463356018,0,-0.8506507873535156,0.5257311463356018,0,-0.8506507277488708,0.525731086730957,0,-0.8506507277488708,0.525731086730957,0,-0.8506507277488708,0.525731086730957,0.525731086730957,6.152907161549592e-8,-0.8506507277488708,0.525731086730957,6.152907161549592e-8,-0.8506507277488708,0.525731086730957,6.152907161549592e-8,-0.8506507277488708,0,0.8506507277488708,-0.525731086730957,0,0.8506507277488708,-0.525731086730957,0,0.8506507277488708,-0.525731086730957,0,0.8506507873535156,-0.5257311463356018,0,0.8506507873535156,-0.5257311463356018,0,0.8506507873535156,-0.5257311463356018,0,0.8506508469581604,-0.5257311463356018,0,0.8506508469581604,-0.5257311463356018,0,0.8506508469581604,-0.5257311463356018,0.5257311463356018,0,-0.8506507873535156,0.5257311463356018,0,-0.8506507873535156,0.5257311463356018,0,-0.8506507873535156,0.5257311463356018,0,0.8506507873535156,0.5257311463356018,0,0.8506507873535156,0.5257311463356018,0,0.8506507873535156,0.8506507277488708,0.525731086730957,0,0.8506507277488708,0.525731086730957,0,0.8506507277488708,0.525731086730957,0,0.8506507873535156,0.5257311463356018,0,0.8506507873535156,0.5257311463356018,0,0.8506507873535156,0.5257311463356018,0,0,0.8506507277488708,0.525731086730957,0,0.8506507277488708,0.525731086730957,0,0.8506507277488708,0.525731086730957,0.8506508469581604,0.5257311463356018,0,0.8506508469581604,0.5257311463356018,0,0.8506508469581604,0.5257311463356018,0,0,0.8506507873535156,0.5257311463356018,0,0.8506507873535156,0.5257311463356018,0,0.8506507873535156,0.5257311463356018]

AFRAME.registerGeometry('unwrapped-dodecahedron', {
  schema: {
    radius: {default: 1.0},
  },
  init: function (data) {
    this.geometry = new THREE.DodecahedronBufferGeometry(data.radius);
    this.geometry.attributes.position.array.set(unwrappedDDHpos)
    this.geometry.attributes.position.needsUpdate = true
    this.geometry.attributes.normal.array.set(unwrappedDDHNorm)
    this.geometry.attributes.normal.needsUpdate = true
    this.geometry.attributes.uv.array.set(unwrappedDDHUvs)
    this.geometry.attributes.uv.needsUpdate = true
  }
});

(async () => {
  window.Pako = await import('pako')
})();

var headGeo = null;
var headMerged = false;

(function() {
  new THREE.GLTFLoader().load(require('./assets/head-base.glb'), (model) => {
    headGeo = model.scene.getObjectByProperty('type', 'Mesh').geometry;
  })
})();

AFRAME.registerGeometry('head-base', {
  init: function (data) {
    if (!headGeo) {
      console.error("Loading head-base too soon!!")
    }
    if (!headMerged)
    {
      headGeo = BufferGeometryUtils.mergeVertices(headGeo,  1.0e-2)
      headMerged = true
    }
    this.geometry = headGeo;
  }
})