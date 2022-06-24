const puppeteer = require('puppeteer')
const fs = require('fs')
const path = require('path');
const ls = require('ls');

var browser

async function generateThumbnail(path, output)
{
  options = {
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  }

  if (!browser)
  {
    browser = await puppeteer.launch(options)
  }

  let page = await browser.newPage()
  await page.goto("https://vartiste.xyz", { waitUntil: 'networkidle2' })
  await page.waitForFunction(() => window.passedLoadTest)

  let [fileChooser] = await Promise.all([
    page.waitForFileChooser(),
    page.evaluate(() => {
      (async function () {
        document.querySelector('#settings-shelf-load-button').click()
        await VARTISTE.Util.delay(100)
        document.querySelector('*[load-shelf]').components['load-shelf'].browse()
      })()
    }),
  ]);

  await fileChooser.accept([path]);

  await page.waitForFunction(() => window.loadedSuccessfully || !document.querySelector('a-scene').systems['busy-indicator'].indicators[0].el.object3D.visible, {timeout: 5 * 60 * 1000})

  await page.waitForTimeout(100)

  await page.screenshot({path: output})

  page.close()
}

async function generateDirectoryThumbnails(inputDir)
{
  let directoriesToTry = Array.from(new Set(ls(`${inputDir}/*/*.vartiste{z,}`).map(p => p.path)).values())

  console.log(`Generating ${directoriesToTry.length} directory thumbnails from '${inputDir}/*/*.vartiste{z,}'`)

  for (let dir of directoriesToTry)
  {
    let file = ls(`${dir}/*.vartiste{z,}`)[0]

    if (!file)
    {
      console.warn("No project for", dir)
      continue
    }

    console.log("Generating", file.full, `${file.path}/thumbnail.png`)
    await generateThumbnail(file.full, `${file.path}/thumbnail.png`)

    let desktopIni = `
[ViewState]
Mode=
Vid=
FolderType=Generic
Logo=${file.path.toString().replace(/\//g, path.sep)}\\thumbnail.png
`
    fs.writeFileSync(`${file.path}/desktop.ini`, desktopIni)
  }
}

let inputOpt = process.argv[2]
let outputOpt = process.argv[3]

if (inputOpt && fs.lstatSync(inputOpt).isDirectory())
{
  generateDirectoryThumbnails(inputOpt).then(() => process.exit())
}
else if (inputOpt)
{
  if (!outputOpt)
  {
    outputOpt = `${path.dirname(inputOpt)}/thumbnail-${path.basename(inputOpt)}.png`
  }

  generateThumbnail(inputOpt, outputOpt).then(()=> process.exit())

}
else
{
  console.error("Usage: node thumbnail-generator.js INPUT_VARTISTEZ_FILE|INPUT_DIRECTORY [OUTPUT_FILE]")
  process.exit(-1)
}
