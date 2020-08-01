echo "## This is a CI build script. Not intended for normal use ##"

rm -r dist

set -e

npx webpack

cp src/toolkit/{package.json,Readme.md} dist/

cd dist

cat > ~/.npmrc <<END
registry=https://registry.npmjs.com/
_auth="$NPM_DEPLOY_KEY"
email=zach.geek@gmail.com
always-auth=true
END

npm publish
