import Pako from 'pako'

onmessage = function (event) {
  postMessage(Pako.deflate(JSON.stringify(event.data)));
};
