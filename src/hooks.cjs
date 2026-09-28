'use strict';
const fs = require('node:fs');
const path = require('node:path');
const Ejs = require('ejs');
const { getChannel, readOptions } = require('./channel.cjs');
const { packageBuild } = require('./package.cjs');
exports.throwError = true;
exports.onBeforeInit = function (options) {
  readOptions(options);
  if (options.server) throw new Error('Playable does not support an external asset server');
  // CLI defaults or saved project settings may enable inline maps; normalize before compiler parameters are initialized.
  if (options.sourceMaps && options.sourceMaps !== 'false') {
    console.info('[Playable] Disabled source maps for advertisement delivery.');
  }
  options.sourceMaps = false;
};
exports.onAfterInit = function (options) {
  // Hide the delivery overlay without changing the project debug compilation option.
  options.appTemplateData.showFPS = false;
  options.buildEngineParam.split = false;
  options.buildEngineParam.assetURLFormat = 'runtime-resolved';
};
exports.onAfterBundleInit = function (options) {
  options.buildScriptParam.system = { preset: 'web' };
  options.buildScriptParam.flags.WEBGPU = false;
  const index = options.includeModules.indexOf('gfx-webgpu');
  if (index >= 0) options.includeModules.splice(index, 1);
};
exports.onBeforeCompressSettings = function (options, result) {
  result.settings.screen.orientation = readOptions(options).orientation;
  if (result.settings.assets.server || result.settings.assets.remoteBundles?.length) {
    throw new Error('Remote bundles are not supported in playable builds');
  }
};
exports.onBeforeCopyBuildTemplate = async function (options, result) {
  const root = result.paths.dir;
  const channel = getChannel(readOptions(options).channel);
  const url = target => './' + path.relative(root, target).split(path.sep).map(encodeURIComponent).join('/');
  const templateDir = path.join(__dirname, '../static/templates');
  const bootstrap = await Ejs.renderFile(path.join(templateDir, 'index.js.ejs'), {
    applicationURL: JSON.stringify(url(result.paths.applicationJS)),
  });
  const transformed = await this.utils.transformCode(bootstrap, { importMapFormat: 'systemjs' });
  if (!transformed) throw new Error('Could not compile playable bootstrap');
  result.paths.indexJs = path.join(root, 'index.js');
  result.paths.indexHTML = path.join(root, 'index.html');
  fs.writeFileSync(result.paths.indexJs, transformed);
  fs.copyFileSync(path.join(__dirname, 'playable-runtime.js'), path.join(root, 'playable-runtime.js'));
  fs.copyFileSync(path.join(templateDir, 'style.css'), path.join(root, 'style.css'));
  fs.writeFileSync(result.paths.indexHTML, await Ejs.renderFile(path.join(templateDir, 'index.ejs'), {
    title: options.name || 'Playable',
    sdkURL: channel.sdkURL,
    polyfillsURL: result.paths.polyfillsJs ? url(result.paths.polyfillsJs) : '',
    systemURL: url(result.paths.systemJs),
    importMapURL: url(result.paths.importMap),
  }));
  options.md5CacheOptions.includes.push('index.js', 'style.css');
  options.md5CacheOptions.excludes.push('playable-runtime.js', ...channel.extraRootFiles);
  options.md5CacheOptions.replaceOnly.push('index.html');
};
exports.onAfterBuild = async function (options, result) {
  const settings = readOptions(options);
  result.settings.plugins.jsList = result.settings.plugins.jsList.map(url => url.split('/').map(encodeURIComponent).join('/'));
  fs.writeFileSync(result.paths.settings, JSON.stringify(result.settings));
  const channel = getChannel(settings.channel);
  for (const file of channel.createFiles(settings)) {
    fs.writeFileSync(path.join(result.paths.dir, file.name), file.data);
  }
  const report = await packageBuild(result.paths.dir, channel.id);
  this.buildExitRes.custom = { ...(this.buildExitRes.custom || {}), playable: report };
  console.log('[Playable] ' + channel.displayName + ' ZIP: ' + report.archive);
};
