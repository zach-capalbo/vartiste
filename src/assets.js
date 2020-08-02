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

  if (assetSrc.startsWith("asset/") && VARTISTE_TOOLKIT_URL)
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
