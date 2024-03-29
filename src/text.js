require('aframe-troika-text');

const replaceText = (() => {
  if (window.VARTISTE_TOOLKIT) {
    if (window.VARTISTE_TOOLKIT.replaceTextWithTroikaText === 'auto')
    {
      if (VARTISTE_TOOLKIT.includeFiles && VARTISTE_TOOLKIT.includeFiles.length)
      {
        return false
      }

      if (VARTISTE_TOOLKIT.includeComponents && VARTISTE_TOOLKIT.includeComponents.length)
      {
        return false
      }

      return true
    }
    return !!window.VARTISTE_TOOLKIT.replaceTextWithTroikaText;
  }

  return true
})();

;((replaceText) => {
if (!replaceText) return

if (window.VARTISTE_TOOLKIT) {
  console.info("VARTISTE TOOLKIT NEW BEHAVIOR NOTICE: Replacing AFRAME text component with TroikaText shim. Set VARTISTE_TOOLKIT.replaceTextWithTroikaText = false to disable this")
}

const TEXT_SCHEMA = AFRAME.components['text'].schema
delete AFRAME.components.text

// This is the shim which replaces the built-in AFRAME `text` component with the
// [`troika-text`](https://github.com/lojjic/aframe-troika-text/) component. It
// accepts all of the properties of the [AFRAME `text` component](https://aframe.io/docs/1.2.0/components/text.html)
// and automatically converts them to the relevant `troika-text` properties. You
// _should_ be able to continue using `text` without having to change any code
// but there may be small inconsistencies.
//
// In order to enable this, you may need to set [VARTISTE_TOOLKIT.replaceTextWithTroikaText](#customization)
// to `true`
AFRAME.registerComponent('text', {
  dependencies: ['troika-text'],
  schema: Object.assign({}, TEXT_SCHEMA,{
    // font: {default: "https://fonts.gstatic.com/s/nunito/v14/XRXW3I6Li01BKofA6sKUYevO.woff"}
    font: {default: window.VARTISTE_TOOLKIT_URL ? `${VARTISTE_TOOLKIT_URL}/${require('./assets/font.woff')}`
                                                : require('./assets/font.woff')}
  }),
  update(oldData) {
    let troikaData = {}

    for (let propName in this.data)
    {
      if (propName in AFRAME.components['troika-text'].schema)
      {
        troikaData[propName] = this.data[propName]
      }
    }

    troikaData.value = `${troikaData.value}`

    let fontWidthFactor = 1.6;

    if (this.data.width == 'auto')
    {
      troikaData.maxWidth = 1
    }
    else if (this.data.width)
    {
      troikaData.maxWidth = this.data.width
    }
    else if (this.data.wrapCount)
    {
      troikaData.maxWidth = (0.5 + this.data.wrapCount) * fontWidthFactor
    }

    if (this.data.wrapCount && this.data.width)
    {
      troikaData.fontSize = fontWidthFactor * this.data.width / this.data.wrapCount
    }

    if (this.data.zOffset)
    {
      this.el.components['troika-text'].troikaTextMesh.position.z = this.data.zOffset
    }

    this.el.setAttribute('troika-text', troikaData)
    this.updateLayout()
  },
  // remove() {
  //   this.el.removeAttribute('troika-text')
  // },
  updateLayout () {
    var anchor;
    var baseline;
    var el = this.el;
    var data = this.data;
    var mesh = this.el.components['troika-text'].troikaTextMesh;

    if (!mesh) return;
    if (!this.setMesh) {
      mesh.addEventListener('synccomplete', this.onSync.bind(this))
      this.setMesh = true
    }

    var geometry = mesh.geometry;
    var geometryComponent;


    if (!mesh || !geometry) { return; }

    const DEFAULT_WIDTH = 1;

    geometryComponent = el.getAttribute('geometry');

    if (geometryComponent && geometryComponent.primitive === 'plane') {
      if (!geometryComponent.width) this.setWidth = true;
      if (!geometryComponent.height) this.setHeight = true;
    }

    mesh.position.x = this.data.xOffset
    mesh.position.y = this.data.yOffset
    mesh._needsSync = true
    mesh.sync()
  },
  onSync() {
    var el = this.el;
    var data = this.data;
    var mesh = this.el.components['troika-text'].troikaTextMesh;
    var geometry = mesh.geometry;
    var geometryComponent;
    geometryComponent = el.getAttribute('geometry');
    // Determine width to use (defined width, geometry's width, or default width).

    let width = (geometry.boundingBox.max.x - geometry.boundingBox.min.x) * 1.1
    let height = (geometry.boundingBox.max.y - geometry.boundingBox.min.y) * 1.1

    // Determine wrap pixel count. Either specified or by experimental fudge factor.
    // Note that experimental factor will never be correct for variable width fonts.


      if (this.setWidth) { el.setAttribute('geometry', 'width', width); }
      if (this.setHeight) { el.setAttribute('geometry', 'height', height); }
      if (this.setWidth || this.setHeight)
      {
        if (this.data.anchor === 'left') { el.getObject3D('mesh').position.x = width / 2 / 1.1}
        else if (this.data.anchor === 'right') { el.getObject3D('mesh').position.x = - width / 2 / 1.1}
        if (this.data.baseline === 'top') { el.getObject3D('mesh').position.y = - height / 2 / 1.1}
        else if (this.data.baseline === 'bottom') { el.getObject3D('mesh').position.y = height / 2 / 1.1}
      }
  }
})

// AFRAME.components['text'] = AFRAME.components['vartiste-text']
})(replaceText)

// This shifts the geometry for non-troika text to match the text's baseline property
AFRAME.registerComponent('text-geometry-shifter', {
  dependencies: ['text'],
  init() {
    if (replaceText) return;
    let oldUpdateLayout = this.el.components.text.updateLayout;
    this.el.components.text.updateLayout = function(...args) {
      oldUpdateLayout.call(this, ...args)
      let data = this.el.getAttribute('text')
      let height = this.el.getAttribute('geometry').height
      if (data.baseline === 'top') { this.el.getObject3D('mesh').position.y = - height / 2 / 1.1}
      else if (data.baseline === 'bottom') { this.el.getObject3D('mesh').position.y = height / 2 / 1.1}
    }
  }
})
