const assert = require('assert');

const LANDING_TEXT = "VARTISTE - WebXR Drawing, Texturing, and more!";
const LOAD_TIME = 40;

Feature('load');

Scenario('Access Page', (I) => {
  I.amOnPage("/index.html");
  I.see(LANDING_TEXT)
  I.waitForFunction(() => window.passedLoadTest, LOAD_TIME)
  I.dontSee("It looks like VARTISTE Crashed")
});

Scenario('Load Preset', async (I) => {
  I.amOnPage("/index.html?load=gallery/hubs_avatar.vartiste");
  I.see(LANDING_TEXT)
  I.waitForFunction(() => window.passedLoadTest, LOAD_TIME)
  I.waitForFunction(() => window.loadedSuccessfully, 100)
  let meshLength = await I.executeScript(() => Compositor.meshes.length)
  assert.equal(meshLength, 2)

  I.handleDownloads()
  I.executeScript(() => document.querySelector('a-scene').systems['settings-system'].saveAction())
  I.amInPath('output/downloads');
  I.seeFileNameMatching('.vartiste')

  I.handleDownloads()
  I.executeScript(() => document.querySelector('a-scene').systems['settings-system'].export3dAction())
  I.amInPath('output/downloads');
  I.seeFileNameMatching('.glb');

  await I.checkLogForErrors()
});

Scenario('Crash the page', async (I) => {
  I.amOnPage("/index.html?load=gallery/hubs_avatar.vartiste");
  I.see(LANDING_TEXT)
  I.waitForFunction(() => window.passedLoadTest, LOAD_TIME)
  I.waitForFunction(() => window.loadedSuccessfully, 100)

  I.executeScript(() => document.querySelector('a-scene').systems['crash-handler'].shouldCrash = true)
  I.see("It looks like VARTISTE Crashed")
  await I.grabBrowserLogs()
})

Scenario('Toolkit Docs', async (I) => {
  I.amOnPage("/docs.html");
  I.see("glb-exporter")
  await I.checkLogForErrors()
})

Scenario('Toolkit test', async (I) => {
  I.amOnPage("/toolkit-test.html");
  I.waitForFunction(() => document.querySelector('a-scene').hasLoaded, 20)
  I.executeScript(() =>
  {
    Object.entries(document.querySelector('a-scene').systems).find(e => e[1].tick)[1].tick = () => window.hasTicked = true
  })
  I.waitForFunction(() => window.hasTicked, 20)
  await I.checkLogForErrors()
})

Scenario('Skeletonator', async (I) => {
  I.amOnPage("/index.html?load=gallery/hubs_avatar.vartiste");
  I.see(LANDING_TEXT)
  I.waitForFunction(() => window.passedLoadTest, LOAD_TIME)
  I.waitForFunction(() => window.loadedSuccessfully, 100)
  let meshLength = await I.executeScript(() => Compositor.meshes.length)
  assert.equal(meshLength, 2)

  I.executeScript(() => {
    document.querySelector('*[tooltip="Skeletonator Animation Tool"]').emit('click', {})
  })
  I.waitForFunction(() => Skeletonator.meshes.length, 20)
  await I.checkLogForErrors()
})
