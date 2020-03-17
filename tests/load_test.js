Feature('load');

Scenario('test something', (I) => {
  I.amOnPage("/index.html");
  I.see("VARTISTE is intended to be used with a virtual reality headset.")
  I.waitForFunction(() => window.passedLoadTest, 20)
});
