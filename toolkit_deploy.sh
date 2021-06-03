echo "## This is a CI build script. Not intended for normal use ##"

set -v

rm -r dist

set -e

npx webpack

cp src/toolkit/{package.json,Readme.md} dist/

cd dist

rm -r stats/

rm -r assets/

rm -r ai/

rm *.vartiste-brushes

npm set registry https://registry.npmjs.org
npm set //registry.npmjs.org/:_authToken $NPM_DEPLOY_KEY

# npm publish || cat /root/.npm/_logs/*

npm pack
