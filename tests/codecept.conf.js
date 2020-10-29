const { setHeadlessWhen } = require('@codeceptjs/configure');
const fs = require('fs')

// turn on headless mode when running with HEADLESS=true environment variable
// HEADLESS=true npx codecept run
setHeadlessWhen(process.env.HEADLESS);



let destUrl = 'http://localhost:8080'

if (process.env.CI)
{
  let jobId = fs.readFileSync("../dist/CI_JOB_ID").toString().trim()
  destUrl = `https://zach-geek.gitlab.io/-/vartiste/-/jobs/${jobId}/artifacts/dist/`;
  console.log("Setting destUrl", destUrl)
}

exports.config = {
  tests: './*_test.js',
  output: './output',
  helpers: {
    Puppeteer: {
      url: destUrl,
      show: process.env.HEADLESS != "true",
      // browser: 'firefox',
      chrome: {
        "args": [
          '--use-gl=swiftshader',
          // '--enable-precise-memory-info',
      		// '--enable-begin-frame-control',
      		// '--enable-surface-synchronization',
      		// '--run-all-compositor-stages-before-draw',
      		// '--disable-threaded-animation',
      		// '--disable-threaded-scrolling',
      		// '--disable-checker-imaging',
          "--no-sandbox"
        ]
      }
    },
    FileSystem: {
    }
  },
  include: {
    I: './steps_file.js'
  },
  bootstrap: null,
  mocha: {},
  name: 'tests',
  plugins: {
    retryFailedStep: {
      enabled: true
    },
    screenshotOnFail: {
      enabled: true
    }
  }
}
