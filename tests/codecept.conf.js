const { setHeadlessWhen } = require('@codeceptjs/configure');

// turn on headless mode when running with HEADLESS=true environment variable
// HEADLESS=true npx codecept run
setHeadlessWhen(process.env.HEADLESS);



let destUrl = 'http://localhost:8080'

if (process.env.CI_JOB_ID)
{
  destUrl = `https://zach-geek.gitlab.io/-/vartiste/-/jobs/${process.env.CI_JOB_ID}/artifacts/dist/index.html`;
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
