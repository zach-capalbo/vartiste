// https://stackoverflow.com/a/54123275
// Stack overflow answer from 张浩然 https://stackoverflow.com/users/8257388/%e5%bc%a0%e6%b5%a9%e7%84%b6

// base64 to buffer
async function base64ToBufferAsync(base64) {
  var dataUrl = "data:application/octet-binary;base64," + base64;

  return await new Promise((r,e) => {
  fetch(dataUrl)
    .then(res => r(res.arrayBuffer()))
    // .then(buffer => {
    //   r(new Uint8Array(buffer));
    // })
  })
}

// buffer to base64
function bufferToBase64Async( buffer ) {
    var blob = new Blob([buffer], {type:'application/octet-binary'});
    // console.log("buffer to blob:" + blob)

    return new Promise((r, e) => {
      var fileReader = new FileReader();
      fileReader.onload = function() {
        var dataUrl = fileReader.result;
        var base64 = dataUrl.substr(dataUrl.indexOf(',')+1)
        r(base64)
      };
      fileReader.onerror = e;
      fileReader.readAsDataURL(blob);
    });
}

export {base64ToBufferAsync, bufferToBase64Async}
