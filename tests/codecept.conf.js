const { setHeadlessWhen } = require('@codeceptjs/configure');
const fs = require('fs')

// turn on headless mode when running with HEADLESS=true environment variable
// HEADLESS=true npx codecept run
setHeadlessWhen(process.env.HEADLESS);



let destUrl = 'http://localhost:8080'

if (process.env.CI)
{
  let jobId = fs.readFileSync("../dist/CI_JOB_ID").toString().trim()
  destUrl = `https://zach-geek.gitlab.io/-/vartiste/-/jobs/${jobId}/artifacts/dist/index.html`;
  console.log("Setting destUrl", destUrl)
}

exports.config = {
  tests: './*_test.js',
  output: './output',
  helpers: {
    Puppeteer: {
      url: destUrl,
      show: process.env.HEADLESS != "true"
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
