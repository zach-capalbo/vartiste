const { createFFmpeg, fetchFile } = require('@ffmpeg/ffmpeg');

const ffmpeg = createFFmpeg({ log: true });
ffmpeg.fetchFile = fetchFile;

export {ffmpeg}
