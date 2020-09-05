var loaderUtils = require("loader-utils");
var { parseToMarkdown } = require('./componentParser.js')
var path = require('path')
// console.debug("DOCGEN LOADER LOADED")
module.exports = function(source) {
  this.cacheable && this.cacheable(true);

  // console.debug("DOCGEN PARSING>>>>", source.slice(0,80))

  // this.addDependency(path.resolve("./componentParser.js"))

  return parseToMarkdown(source, {
    filename: this.resourcePath.split(/\/|\\/).slice(-1)[0],
    sourceBaseURL: "https://gitlab.com/zach-geek/vartiste/-/blob/release/src/"
  })
}
