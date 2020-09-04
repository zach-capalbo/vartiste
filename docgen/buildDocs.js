config = {
  sourceBaseURL: "https://gitlab.com/zach-geek/vartiste/-/blob/release/src/",
  srcDir: "../src",
  outputDir: "../dist/docs"
}

var fs = require('fs')
var ls = require('ls')
var { parseToMarkdown } = require('./componentParser.js')

for (let file of ls(`${config.srcDir}/*.js`))
{
  console.log("Parsing", file.file)
  let markdown = parseToMarkdown(fs.readFileSync(file.full), {
    filename: file.file,
    sourceBaseURL: config.sourceBaseURL
  })
  fs.writeFileSync(`${config.outputDir}/${file.name}.md`, markdown)
}
