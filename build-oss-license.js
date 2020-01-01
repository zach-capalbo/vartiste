var crawler = require('npm-license-crawler')
const os = require('os')
const fs = require('fs')
const fetch = require('node-fetch')
const ls = require('ls')

function readLicenseFile({name, path}) {
  let licenses = ls(`${path}/*`).filter(({name}) => /license/i.test(name))

  console.log(name, path, licenses)

  if (licenses.length != 1)
  {
    throw new Error("Couldn't determine license out of " + licenses)
  }

  return fs.readFileSync(licenses[0].full)
}

function build() {
  let f = fs.createWriteStream('src/assets/oss-licenses-used.txt')

  f.write("This software is licensed under the following agreement:\n\n", 'utf8')

  f.write(fs.readFileSync('LICENSE'), 'utf8')

  f.write("\n\nThis software incorporates the following components:", 'utf8')

  for (let {path, full} of ls('node_modules/*/package.json'))
  {
    console.log(path, full)
    let package = JSON.parse(fs.readFileSync(full))
    const {name} = package

    let preamble = `\n\n${name} is used under the following license agreement:\n\n`
    let license;

    try {
      license = readLicenseFile({name, path})
      f.write(preamble,'utf8')
      f.write(license,'utf8')
    }
    catch(e)
    {
      f.write(`\n\n${name} is used under the ${package.license} license.`)
    }
  }
}

build()
