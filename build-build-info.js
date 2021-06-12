// CI Script to deal with gitlab runner running out of memory
const buildInfo = require('./src/build-info.js')
const fs = require('fs')

buildInfo().then(b => {
  fs.writeFileSync('./src/built-info.js', b.code)
})
