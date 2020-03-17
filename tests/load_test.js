Feature('load');

Scenario('test something', (I) => {
  I.amOnPage("/");
  I.see("VARTISTE is intended to be used with a virtual reality headset.")
  I.waitForFunction(() => window.passedLoadTest, 5)
});
