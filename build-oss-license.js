var crawler = require('npm-license-crawler')
const os = require('os')
const fs = require('fs')
const fetch = require('node-fetch')

options = {
    start: ['.'],
    json: false,
    unknown: false
};

function getLicenses() {
  return new Promise((r,e) => {
    crawler.dumpLicenses(options,
      function(error, res){
          if (error) {
              e(error)
          }
          else {
              r(res)
          }
      }
    );
  });
}
async function build() {
  try
  {
    let l = await getLicenses()

    let f = fs.createWriteStream('src/assets/oss-licenses-used.txt')

    f.write(`
The following software packages are used in this product:
    `, 'utf8')

    for (let sw in l)
    {
      try {
        let preamble = `\n\n${sw} is used under the following license agreement:\n\n`
        let license = await fetch(l[sw].licenseUrl, {
          headers: {
            'content-type': 'plain/text'
          }
        }).then(r=>r.text())

        if (/html/i.test(license))
        {
          throw new Error("License is html")
        }

        f.write(preamble,'utf8')
        f.write(license,'utf8')
      }
      catch (e)
      {
        f.write(`\n\n${sw} is used under the ${l[sw].licenses} license found at ${l[sw].licenseUrl}`)
      }
    }

    f.end
  }
  catch (e)
  {
    console.error(e)
    os.exit(-1)
  }
}

build()
