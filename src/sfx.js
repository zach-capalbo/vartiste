import {Util} from "./util.js"

AFRAME.registerSystem('sfx-system', {
  init() {
    let soundContainer = document.createElement('a-entity')
    soundContainer.id = "sfx-container"
    this.el.append(soundContainer)
    for (let asset of document.querySelectorAll('a-assets audio'))
    {
      let entity = document.createElement('a-entity')
      entity.setAttribute('sound', `src: #${asset.id}; distanceModel: inverse; volume: 0.0; refDistance: 0.3; rolloffFactor: 1; positional: false`)
      entity.id = `sfx-${asset.id.slice("asset-".length)}`
      soundContainer.append(entity)
    }

    // Try to work around bug that slows chrome down
    Util.whenLoaded(soundContainer, () => {
      Object.defineProperty(this.el.audioListener.context.listener, 'positionX', {value: undefined})
    })
  }
})

class SfxMgr {
  constructor() {
    const map = {
      click: 'navigation_hover-tap',//'clock',
      clock: false,// 'click',
      joystick: 'navigation_backward-selection',
      bang: 'sfx-clock',
    }

    for (let k in map)
    {
      if (map[k])
      {
        this[k] = this.play.bind(this, map[k])
      }
      else
      {
        this[k] = function() {}
      }
    }
  }

  play(sfx, el, {volume = 1.0} = {}) {
    // if (el.components.sound) el.components.sound.stopSound()
    // el.setAttribute('sound', `src: #asset-${sfx.sfx || sfx}; distanceModel: inverse; refDistance: 0.8; rolloffFactor: 1.3; volume: ${volume}`)
    // el.components.sound.playSound()

    console.log("Finding", `sfx-${sfx.sfx || sfx}`)
    let sound = document.getElementById(`sfx-${sfx.sfx || sfx}`)
    el.object3D.getWorldPosition(sound.object3D.position)
    sound.setAttribute('sound', {volume})
    sound.components.sound.playSound()
  }
  draw(el) {
    return
    if (el.sfxAlreadyDrawing) return

    el.sfxAlreadyDrawing = true
    el.addEventListener('enddrawing', () => this.endDraw(el), {once: true})
    this.play('tap-resonant', el, {volume: 0.05})


    // return
    // let t = el.sceneEl.time
    // if ( el.components.sound && t - el.components.sound.sfxLastPlayTime < 10) return
    // let sfx = 'noise'
    // el.setAttribute('sound', `src: #asset-sfx-${sfx}; distanceModel: inverse; refDistance: 0.3; rolloffFactor: 1; poolSize: 3; volume: 0.1`)
    // el.components.sound.stopSound()
    // el.components.sound.playSound()
    // el.components.sound.sfxLastPlayTime = t
  }
  endDraw(el) {
    el.sfxAlreadyDrawing = false
    this.play('ui_tap-variant-01', el, {volume: 0.2})
  }
}

const Sfx = new SfxMgr()

export {Sfx}
