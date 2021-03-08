import hljs from 'highlight.js/lib/core';
import javascript from 'highlight.js/lib/languages/javascript';
hljs.registerLanguage('javascript', javascript);
import html from 'highlight.js/lib/languages/xml';
hljs.registerLanguage('html', html);

onmessage = function (event) {
  let result = hljs.highlightAuto(event.data, ['html', 'javascript', 'slim'])
  postMessage(result.value);
};
