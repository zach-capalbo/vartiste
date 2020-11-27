import {Util} from './util.js'

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
  element.classList.add("vartiste-asset")
  return element
}

var haveVartisteAssetsBeenAdded = false;

export function loadAllAssets() {
  let assets = document.querySelector('a-assets')
  for (let fileName of require.context('./assets/', true, /.*/).keys()) {
    assets.append(loadAsset(fileName))
  }
  
  haveVartisteAssetsBeenAdded = true
  assets.parentNode.emit('vartisteassetsadded')
}


// Avoid adding everything twice
var alreadyAttached = false;

// Needed to masquerade as an a-assets element
var fileLoader = new THREE.FileLoader();

function fixUpMediaElement(el) {
  return el
}

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
        // for (let fileName of require.context('./assets/', true, /.*/).keys()) {
        //   this.append(loadAsset(fileName))
        // }

        var parent = this.parentNode

        // Copy the parent's timeout, so we don't give up too soon
        this.setAttribute('timeout', parent.getAttribute('timeout'))

        // Make the parent pretend to be a scene, since that's what a-assets expects
        // this.parentNode.isScene = true

        // Since we expect the parent element to be a-assets, this will invoke the a-asset attachedCallback,
        // which handles waiting for all of the children to load. Since we're calling it with `this`, it
        // will wait for the streetmix-assets's children to load
        // Object.getPrototypeOf(parent).attachedCallback.call(this)

        // No more pretending needed
        // this.parentNode.isScene = false

        if (haveVartisteAssetsBeenAdded)
        {
          this.load()
        }
        else
        {
          parent.parentNode.addEventListener('vartisteassetsadded', () => {
            this.load()
          })
        }
      }
    },
    load: {
      value: function() {
        let parent = this.parentNode
        let loaded = []
        // Wait for <img>s.
        let imgEls = parent.querySelectorAll('img.vartiste-asset');
        for (let i = 0; i < imgEls.length; i++) {
          let imgEl = fixUpMediaElement(imgEls[i]);
          // imgEl = imgEls[i];
          loaded.push(new Promise(function (resolve, reject) {
            // Set in cache because we won't be needing to call three.js loader if we have.
            // a loaded media element.
            THREE.Cache.files[imgEls[i].getAttribute('src')] = imgEl;
            imgEl.onload = resolve;
            imgEl.onerror = reject;
          }));
        }

        // Wait for <audio>s and <video>s.
        let mediaEls = this.querySelectorAll('audio.vartiste-asset, video.vartiste-asset');
        for (let i = 0; i < mediaEls.length; i++) {
          let mediaEl = fixUpMediaElement(mediaEls[i]);
          if (!mediaEl.src && !mediaEl.srcObject) {
            warn('Audio/video asset has neither `src` nor `srcObject` attributes.');
          }
          loaded.push(mediaElementLoaded(mediaEl));
        }

        Promise.all(loaded).then(() => {
          this.hasLoaded = true
          this.emit('loaded', undefined, false)
          parent.load()
        })

        return


      }
    }
  })
})


var domModifiedHandler = function(evt) {
  // Only care about events affecting an a-scene
  if (evt.target.nodeName !== 'A-SCENE') return;

  // Try to find the a-assets element in the a-scene
  let assets = evt.target.querySelector('a-assets');

  if (!assets) {
    // Create and add the assets if they don't already exist
    assets = document.createElement('a-assets')
    assets.setAttribute('timeout', 60 * 1000 * 5)
    evt.target.append(assets)
  }

  // Already have the streetmix assets. No need to add them
  // if (assets.querySelector('vartiste-assets')) {
  //   document.removeEventListener("DOMSubtreeModified", domModifiedHandler);
  //   return
  // }

  // Create and add the custom streetmix-assets element
  let vartisteAssets = document.createElement('vartiste-assets')
  assets.append(vartisteAssets)

  loadAllAssets()

  // Clean up by removing the event listener
  document.removeEventListener("DOMSubtreeModified", domModifiedHandler);
}

document.addEventListener("DOMSubtreeModified", domModifiedHandler, false);
