var Tone;
const Color = require('color')
const {Util} = require('./util.js')

const Timbres = {
  trumpet: [0.66, 0.54, 0.6, 0.82, 0.83, 0.9, 0.83, 0.71, 0.48, 0.3, 0.21, 0.22, 0.15, 0.1],
  organ: [0.001831, 0.11747, 0.606061, 0.667617, 0.32325, 0.32325, 0.667617, 0.606061, 0.11747],
  ukulele: [0.914102564102564, 1, 0.624358974358974, 0.683333333333333, 0.638461538461538],
  sin: [1.0],
  marimba: [0.8105694691387023,0,-0.0900632743487447,0,0.8434636622299385,0,-0.016542234064055146,0,0.010007030483193857,0,-0.00669892123255126,0,0.0018838011188271615,1,-0.0036025309739497885,1,0.0028047386475387615,0]
}
const Voices = {
  red: {pitch: 5.0, pan: 1.0, timbre: 'trumpet'},
  green: {pitch: 1.5, pan: 0.0, timbre: 'organ'},
  blue: {pitch: 1.0, pan: 0.5, timbre: 'trumpet'},
  yellow: {pitch: 4.0, pan: 0.8, timbre: 'ukulele'},
  white: {pitch: 2.0, pan: 1.0, timbre: 'sin'},
}

// Standalone Kromophone class. Can be accessed from
// `sceneEl.systems.kromophone.kromophone`. See [`#system_kromophone`]
class Kromophone {
  constructor() {
    this.baseFrequency = 140;
    this.voice = {}
    this.envelope = new Tone.AmplitudeEnvelope({
      attack: 0.11,
			decay: 0.0,
			sustain: 0.5,
			release: 1.2
  	});
    let voiceConnection = this.envelope
    let o = this.envelope;

    // Roughness
    // let noise = new Tone.Noise("pink").start();
    // const mult = new Tone.Multiply(0.0);
    // this.noise = mult
    // noise.connect(mult);
    // let add = new Tone.Add();
    // voiceConnection = add;
    // mult.connect(add.addend)
    // voiceConnection.connect(o)

    o.toDestination()
    for (let color in Voices)
    {
      this.voice[color] = this.createVoice(Voices[color])
      this.voice[color].gain.connect(voiceConnection)
    }
  }
  createVoice(voice) {
    let frequency = this.baseFrequency * voice.pitch
    let timbre = Timbres[voice.timbre]
    //create a synth and connect it to the main output (your speakers)
    const gain = new Tone.Gain(0);
    const panner = new Tone.Panner(voice.pan * 2 - 1).connect(gain)
    const synth = new Tone.Oscillator({
      "mute": false,
      "volume": -14,
      "detune": 0,
      "frequency": frequency,
      "partialCount": timbre.length,
      "partials": timbre,
      "phase": 0,
      "type": "custom"
    }).connect(panner)

    synth.start();
    return {synth, gain}
  }
  rebase(frequency) {
    this.baseFrequency = frequency
    for (let color in this.voice)
    {
      this.voice[color].synth.frequency.value = Voices[color].pitch * frequency
    }
  }
  transform(color) {
    let {r,g,b} = color.unitObject();
    let s = Math.min(r,g,b)
    let y = Math.min(r,g) - s
    this.voice.red.gain.gain.value = r - y - s;
    this.voice.green.gain.gain.value = g - y - s;
    this.voice.blue.gain.gain.value = b - s;
    this.voice.yellow.gain.gain.value = y;
    this.voice.white.gain.gain.value = s;
  }
  static get Timbres() {return Timbres}
  static get Voices() {return Voices}
};

// Provides the Kromophone color sonification sensory substitution device.
//
// The Kromophone is a system for transforming colors into sounds. It assigns
// instrument voices to different primary colors, and adjusts the volume of each
// voice based on the intensity of the color.
//
// You must call `start()` in order to load the required libraries and start
// sonification.
//
// When `source` is `camera`, the Kromophone will sample a rendered pixel from
// the framebuffer and sonify it. Sonification will occur continuously unless
// `stop` is called. When the source is `paint`, the kromophone will sonify any
// change in paint color (via the `colorchanged`) event or drawing event. When
// the source is `none`, sonification will take place as discrete sound events
// when `sonify(color)` is called.
Util.registerComponentSystem('kromophone', {
  schema: {
    // Source of color for sonification. See [`kromophone` description](#system_kromophone)
    source: {oneOf: ['none', 'camera', 'paint'], default: 'camera'},

    // Enable or disable sonification
    active: {default: false},
  },
  events: {
    colorchanged: function(e) {
      if (!this.kromophone) return;
      if (this.data.source !== 'paint') return;
      this.kromophone.envelope.triggerAttackRelease(0.5)
    },
    startdrawing: function(e) {
      if (!this.kromophone) return;
      if (this.data.source !== 'paint') return;
      this.kromophone.envelope.triggerAttack()
    },
    enddrawing: function(e) {
      if (!this.kromophone) return;
      if (this.data.source !== 'paint') return;
      this.kromophone.envelope.triggerRelease()
    }
  },
  init() {
    this.cameraBytes = new Uint8Array(4);
  },
  update(oldData) {
    if (this.data.active) {
      this.start()
    } else {
      this.stop()
    }
    if (this.data.source !== oldData.source && this.kromophone)
    {
      if (oldData.source === 'camera')
      {
        this.kromophone.envelope.triggerRelease()
      }

      if (this.data.source === 'camera')
      {
        this.kromophone.envelope.triggerAttack()
      }
    }
  },

  // Starts color sonification. If needed, loads required libraries and starts
  // playing sound.  **Note**, sound will not actually be audible until the user
  // interacts with the page due to browser security mechanisms.
  start() {
    if (!this.kromophone) {
      import('tone').then((m) => {
        Tone = m
        this.Tone = Tone
        Tone.start()
        this.kromophone = new Kromophone();

        if (this.data.source === 'camera')
        {
          this.kromophone.envelope.triggerAttack()
        }
      })
    }
    else
    {
      Tone.start()
      Tone.Destination.mute = false;
    }
  },

  // Mutes sound
  stop() {
    if (!Tone) return;
    Tone.Destination.mute = true;
  },
  sonify(color) {
    if (!this.kromophone) return;
    let c = color
    if (color.isColor) {
      c = "#" + color.getHexString()
    }

    this.kromophone.transform(c)
    this.kromophone.envelope.triggerAttackRelease(0.5)
  },
  tick(t,dt) {
    if (!this.kromophone) return;
    if (this.data.source === 'paint')
    {
      let color = this.el.sceneEl.systems['paint-system'].brush.ccolor
      if (color) {
        this.kromophone.transform(color)
      }
    }
  },
  tock(t, dt) {
    if (!this.kromophone) return;
    if (this.data.source !== 'camera') return;
    if (!this.data.active) return;
    let b = this.cameraBytes
    let gl = this.el.sceneEl.renderer.getContext()
    let viewport = gl.getParameter(gl.VIEWPORT);
    if (this.el.sceneEl.is('vr-mode'))
    {
      // -> Left eye toward center a little more
      gl.readPixels(Math.round(viewport[2] *  0.55), Math.round(viewport[3] / 2), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, b)
    }
    else {
      gl.readPixels(Math.round(viewport[2] / 2), Math.round(viewport[3] / 2), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, b)
    }
    this.kromophone.transform(new Color(b))

      // console.log(gl.drawingBufferWidth, gl.drawingBufferHeight, b)

  }
})
