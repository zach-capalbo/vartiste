const { createFFmpeg, fetchFile } = require('!!@flemist/ffmpeg.wasm-st');

const corePath = require('../wasm/ffmpeg-core.js')
// window.ffmpegworker = require('@ffmpeg/core/dist/ffmpeg-core.worker.js')
// window.ffmpegasm = require('@ffmpeg/core/dist/ffmpeg-core.wasm')
window.ffmpegPath = corePath;

require('../wasm/ffmpeg-core.wasm')

const ffmpeg = createFFmpeg({ log: true, corePath: 'ffmpeg-core.js' });
ffmpeg.fetchFile = fetchFile;

export {ffmpeg}
