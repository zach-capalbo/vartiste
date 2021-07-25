const { createFFmpeg, fetchFile } = require('@ffmpeg/ffmpeg');

// const corePath = require('file-loader?name=ffmpeg-core.js!@ffmpeg/core/dist/ffmpeg-core.js')
// window.ffmpegworker = require('@ffmpeg/core/dist/ffmpeg-core.worker.js')
// window.ffmpegasm = require('@ffmpeg/core/dist/ffmpeg-core.wasm')
// window.ffmpegPath = corePath;

const ffmpeg = createFFmpeg({ log: true });
ffmpeg.fetchFile = fetchFile;

export {ffmpeg}
