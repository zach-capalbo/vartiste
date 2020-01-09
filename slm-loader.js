/*
The MIT License (MIT)

Copyright (c) 2016 WealthBar

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

MODIFIED BY Zachary Capalbo 2020
*/

'use strict';

var loaderUtils = require("loader-utils");
var slm = require("slm");
var markdown = require("slm-markdown");
var path = require('path')

markdown.register(slm.template);

module.exports = function(source) {
  this.cacheable && this.cacheable(true);

  var options = loaderUtils.getOptions(this) || {};
  options.filename = this.resourcePath;

  let addDep = (dep) => this.addDependency(dep);

  let oldPartial = slm.template.VM.prototype.partial;
  slm.template.VM.prototype.partial = function(...args) {
    let dep = path.resolve("src/" + args[0])
    console.info("Adding a new dep", dep)
    addDep(dep)
    return oldPartial.apply(this, args)
  }

  options.require = (dep) => {
    dep = path.resolve("src/" + dep)
    this.addDependency(dep)
    let oldCache = require.cache[require.resolve(dep)]
    delete require.cache[require.resolve(dep)]

    let ret = require(dep)

    if (oldCache)
    {
      require.cache[require.resolve(dep)] = oldCache
    }

    return ret
  }

  var tmplFunc = slm.compile(source, options);

  // watch for changes in every referenced file
  Object.keys(slm.template.VM.prototype._cache).forEach(function(dep) {
    dep = path.resolve("src/" + dep)
    console.info("Adding dep", dep)
    this.addDependency(dep);
  }, this);

  // slm cache used to remember paths to all referenced files
  // purge cache after each run to force rebuild on changes

  // each cached chunk is deleted from original object,
  // cause it's referenced by slm internally in other places
  // replacing cache with new object {} will break hot reload
  Object.keys(slm.template.VM.prototype._cache).forEach(function(dep) {
    delete slm.template.VM.prototype._cache[dep];
  });

  return tmplFunc();
};
