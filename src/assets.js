export function loadAsset(fileName) {
  let asset = fileName.slice("./".length)
  if (asset.startsWith(".")) return

  let elementType = 'a-asset-item'

  let assetSrc = require(`./assets/${asset}`)

// if (assetSrc.startsWith("asset/") && /\.(png|jpg)/i.test(assetSrc))
  if ((assetSrc.startsWith("asset/") && /\.(png|jpg)$/i.test(assetSrc) )
    || /^data:image/.test(assetSrc))
  {
    assetSrc = `${assetSrc}`
    elementType = 'img'
  }
  else if (asset.endsWith(".wav"))
  {
    elementType = 'audio'
  }

  if (assetSrc.startsWith("asset/") && window.VARTISTE_TOOLKIT_URL)
  {
    assetSrc = `${VARTISTE_TOOLKIT_URL}/${assetSrc}`
  }

  var element = document.createElement(elementType)

  element.setAttribute("src", assetSrc)
  element.id = `asset-${asset.split(".")[0]}`
  element.setAttribute('crossorigin',"anonymous")
  return element
}

export function loadAllAssets() {
  for (let fileName of require.context('./assets/', true, /.*/).keys()) {
    document.querySelector('a-assets').append(loadAsset(fileName))
  }
}


// Avoid adding everything twice
var alreadyAttached = false;

// Needed to masquerade as an a-assets element
var fileLoader = new THREE.FileLoader();

window.AFRAME.registerElement('vartiste-assets', {
  prototype: Object.create(window.AFRAME.ANode.prototype, {
    createdCallback: {
      value: function() {
        // Masquerade as a an a-asset-item so that a-assets will wait for it to load
        this.setAttribute('src', '')
        this.isAssetItem = true;

        // Properties needed for compatibility with a-assets prototype
        this.isAssets = true;
        this.fileLoader = fileLoader;
        this.timeout = null;
      }
    },
    attachedCallback: {
      value: function () {
        if (alreadyAttached) return;
        if (this.parentNode && this.parentNode.hasLoaded) console.warn("Assets have already loaded. streetmix-assets may have problems")

        alreadyAttached = true;

        console.log("Attaching VARTISTE Assets")

        // Set the innerHTML to all of the actual assets to inject
        // this.innerHTML = buildAssetHTML(this.getAttribute("url"));
        for (let fileName of require.context('./assets/', true, /.*/).keys()) {
          this.append(loadAsset(fileName))
        }

        var parent = this.parentNode

        // Copy the parent's timeout, so we don't give up too soon
        this.setAttribute('timeout', parent.getAttribute('timeout'))

        // Make the parent pretend to be a scene, since that's what a-assets expects
        this.parentNode.isScene = true

        // Since we expect the parent element to be a-assets, this will invoke the a-asset attachedCallback,
        // which handles waiting for all of the children to load. Since we're calling it with `this`, it
        // will wait for the streetmix-assets's children to load
        Object.getPrototypeOf(parent).attachedCallback.call(this)

        // No more pretending needed
        this.parentNode.isScene = false
      }
    },
    load: {
      value: function() {
        // Wait for children to load, just like a-assets
        AFRAME.ANode.prototype.load.call(this, null, function waitOnFilter (el) {
          return el.isAssetItem && el.hasAttribute('src');
        });
      }
    }
  })
})


var domModifiedHandler = function(evt) {
  // Only care about events affecting an a-scene
  if (evt.target.nodeName !== 'A-SCENE') return;

  console.log("Found scene for assets")

  // Try to find the a-assets element in the a-scene
  let assets = evt.target.querySelector('a-assets');

  if (!assets) {
    // Create and add the assets if they don't already exist
    assets = document.createElement('a-assets')
    evt.target.append(assets)
  }

  // Already have the streetmix assets. No need to add them
  // if (assets.querySelector('vartiste-assets')) {
  //   document.removeEventListener("DOMSubtreeModified", domModifiedHandler);
  //   return
  // }

  // Create and add the custom streetmix-assets element
  // let streetMix = document.createElement('vartiste-assets')
  // assets.append(streetMix)

  loadAllAssets()

  // Clean up by removing the event listener
  document.removeEventListener("DOMSubtreeModified", domModifiedHandler);
}

document.addEventListener("DOMSubtreeModified", domModifiedHandler, false);
