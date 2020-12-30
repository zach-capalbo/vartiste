import Pako from 'pako'

onmessage = function (event) {
  postMessage(Pako.deflate(event.data));
};
