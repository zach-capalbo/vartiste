// in this file you can append custom step methods to 'I' object
const assert = require('assert');

module.exports = function() {
  return actor({

    // Define custom steps here, use 'this' to access default methods of I.
    // It is recommended to place a general 'login' function here.
    async checkLogForErrors() {
      let logs = await this.grabBrowserLogs()
      console.log(`L: ${logs[0]._type}`)
      logs.forEach(l => {
        if (/error/i.test(l._type) && !l._text.includes("ws://127.0.0.1:6437/v6.json"))
        {
          assert.fail(l._text)
        }
      })
    }
  });
}
