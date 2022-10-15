require('../app.styl')

var buildInfo;

try {
//  buildInfo = require('../built-info.js')
buildInfo = require('!!val-loader!../build-info.js')
}
catch (e)
{
 // buildInfo = require('!!val-loader!./build-info.js')
 buildInfo = {
   version: "DEV",
   date: new Date().toString()
 }
}

let date = new Date(buildInfo.date);
document.querySelector('#saved-version').innerHTML = `(${buildInfo.version} - ${date.toLocaleDateString()})`
