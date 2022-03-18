import Pako from 'pako'
import {base64ArrayBuffer} from './framework/base64ArrayBuffer.js'

onmessage = function (event) {
  postMessage("data:application/x-binary;base64," +  base64ArrayBuffer(Pako.deflate(JSON.stringify(event.data))));
};
