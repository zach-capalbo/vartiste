// in this file you can append custom step methods to 'I' object
const assert = require('assert');

module.exports = function() {
  return actor({

    // Define custom steps here, use 'this' to access default methods of I.
    // It is recommended to place a general 'login' function here.
    async checkLogForErrors() {
      let logs = await this.grabBrowserLogs()
      logs.forEach(l => {
        if (/error/i.test(l._type) && !l._text.includes("/v6.json") && !l._text.includes("the server responded with a status of 503 ()"))
        {
          assert.fail(l._text)
        }
      })
    }
  });
}
