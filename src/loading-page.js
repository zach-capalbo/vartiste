import {Util} from './util.js'

class LoadingPage {
  constructor() {
    let assets = document.querySelector('vartiste-assets')

    let loadingPage = document.querySelector('#loading-page')
    let progressBar = loadingPage.querySelector('.loading-progress')

    let assetEntries = Object.entries(assets.waitingFor)
    let totalCount = assetEntries.length
    let currentCount = 0

    for (let [name, promise] of assetEntries)
    {
      promise.then(() => {
        currentCount++
        progressBar.style.width = `${currentCount / totalCount * 100}%`
      })
    }

    Util.whenLoaded(document.querySelector('#assets'), () => {
      loadingPage.classList.add('hidden')
    })
  }
}

document.body.addEventListener('vartisteassetsadded', () => {
  new LoadingPage()
}, true)
