const util = require('util');
const exec = util.promisify(require('child_process').exec);
const packageInfo = require('../package.json')

let branchName;
let isRelease;

async function sh(cmd) {
  let {stdout, stderr} = await exec(cmd)
  console.warn(stderr)
  return stdout.trim()
}

async function changeLog() {
  let gitlog = await sh(`git rev-list -n 3 --min-parents=2 --format="%B" HEAD`)
  return gitlog.split(/^commit \w+$/m).slice(1)
}

async function version() {
  let rawVersion = packageInfo.version
  let versionParts = rawVersion.split('.')

  if (!isRelease) {
    return `${versionParts[0]}.${branchName}`
  }

  let mergeCount = await sh(`git rev-list --min-parents=2 HEAD | wc -l`)

  return `${versionParts[0]}.${mergeCount}`

}

module.exports = async function (opions, loaderContext) {
  branchName = process.env.CI_COMMIT_REF_NAME
  if (!branchName) {
    try {
      branchName = await sh(`git symbolic-ref HEAD`)
      branchName = branchName.replace('refs/heads/', "")
    }
    catch (e)
    {
      console.warn(e)
      branchName = "GIT_ERROR"
    }
  }
  isRelease = branchName === 'release'

  let info = await {
    version: await version(),
    date: new Date(),
    changeLog: await changeLog(),
  }
  let code = 'module.exports = ' + JSON.stringify(info)
  return {code: code}
}
