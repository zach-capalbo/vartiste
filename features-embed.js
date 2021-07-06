var fetch = require('node-fetch')
var YAML = require('js-yaml')
const fs = require('fs')


;(async () => {
  var features = YAML.load(fs.readFileSync('./src/static/features.yaml').toString())

  var promises = [];
  for (let section of features.sections)
  {
      for (let feature of section.features)
      {
          for (let tweet of feature.tweets)
          {
              if (tweet.html) continue;
              promises.push(fetch(`https://publish.twitter.com/oembed?url=${encodeURIComponent(tweet.url)}&omit_script=true`)
              .then((r) => r.json())
              .then((t) => {
                  tweet.html = t.html
              }))
          }
      }
  }

  await Promise.all(promises);

  fs.writeFileSync('C:/Users/Admin/scripts/vr/painting/src/static/features.yaml', YAML.dump(features, {lineWidth: -1}))
})();
