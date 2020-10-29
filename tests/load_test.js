const assert = require('assert');

Feature('load');

Scenario('Access Page', (I) => {
  I.amOnPage("/index.html");
  I.see("VARTISTE is intended to be used with a virtual reality headset.")
  I.waitForFunction(() => window.passedLoadTest, 20)
});

Scenario('Load Preset', async (I) => {
  I.amOnPage("/index.html?load=gallery/hubs_avatar.vartiste");
  I.see("VARTISTE is intended to be used with a virtual reality headset.")
  I.waitForFunction(() => window.passedLoadTest, 20)
  I.waitForFunction(() => window.loadedSuccessfully, 100)
  let meshLength = await I.executeScript(() => Compositor.meshes.length)
  assert.equal(meshLength, 2)

  I.handleDownloads()
  I.executeScript(() => document.querySelector('a-scene').systems['settings-system'].saveAction())
  I.amInPath('output/downloads');
  I.seeFileNameMatching('.vartiste')
});
