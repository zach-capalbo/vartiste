const { createFFmpeg, fetchFile } = require('!!@flemist/ffmpeg.wasm-st');

// window.ffmpegworker = require('@ffmpeg/core/dist/ffmpeg-core.worker.js')
// window.ffmpegasm = require('@ffmpeg/core/dist/ffmpeg-core.wasm')

require('../wasm/ffmpeg-core.wasm')

const ffmpeg = createFFmpeg({ log: true, corePath: 'ffmpeg-core.js' });
ffmpeg.fetchFile = fetchFile;

export {ffmpeg}
