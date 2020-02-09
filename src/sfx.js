class SfxMgr {
  constructor() {
    const map = {
      click: 'clock',
      clock: 'click'
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

  play(sfx, el) {
    el.setAttribute('sound', `src: #asset-sfx-${sfx.sfx || sfx}; distanceModel: exponential; refDistance: 0.3; rolloffFactor: 1.3`)
    el.components.sound.stopSound()
    el.components.sound.playSound()
  }
  draw(el) {
    let sfx = 'click'
    el.setAttribute('sound', `src: #asset-sfx-${sfx}; distanceModel: inverse; refDistance: 0.3; rolloffFactor: 1; poolSize: 15; volume: 0.6`)
    el.components.sound.playSound()
  }
}

const Sfx = new SfxMgr()

export {Sfx}
