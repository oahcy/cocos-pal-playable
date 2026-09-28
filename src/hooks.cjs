'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { SDK_URL, orientations, readOptions } = require('./channel.cjs');
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
function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
exports.onBeforeCopyBuildTemplate = async function (options, result) {
  const root = result.paths.dir;
  const url = target => './' + path.relative(root, target).split(path.sep).map(encodeURIComponent).join('/');
  const app = url(result.paths.applicationJS);
  const bootstrap = 'import { Application } from ' + JSON.stringify(app) + ';\n' +
    'const canvas = document.getElementById("GameCanvas");\n' +
    'const size = canvas.parentElement.getBoundingClientRect(); canvas.width = size.width; canvas.height = size.height;\n' +
    'const application = new Application();\n' +
    'System.import("cc").then(engine => application.init(engine)).then(() => application.start()).catch(console.error);';
  const transformed = await this.utils.transformCode(bootstrap, { importMapFormat: 'systemjs' });
  if (!transformed) throw new Error('Could not compile playable bootstrap');
  fs.writeFileSync(path.join(root, 'index.js'), transformed);
  fs.copyFileSync(path.join(__dirname, 'playable-runtime.js'), path.join(root, 'playable-runtime.js'));
  const templateDir = path.join(__dirname, '../static/templates');
  fs.copyFileSync(path.join(templateDir, 'style.css'), path.join(root, 'style.css'));
  const scripts = [
    '<script src="' + SDK_URL + '"></script>',
    '<script src="./playable-runtime.js"></script>',
    result.paths.polyfillsJs ? '<script src="' + escapeHTML(url(result.paths.polyfillsJs)) + '"></script>' : '',
    '<script src="' + escapeHTML(url(result.paths.systemJs)) + '"></script>',
    '<script type="systemjs-importmap" src="' + escapeHTML(url(result.paths.importMap)) + '"></script>',
    '<script>System.import("./index.js").catch(console.error);</script>',
  ].join('\n');
  result.paths.indexJs = path.join(root, 'index.js');
  result.paths.indexHTML = path.join(root, 'index.html');
  const template = fs.readFileSync(path.join(templateDir, 'index.html'), 'utf8');
  const values = { title: escapeHTML(options.name || 'Playable'), scripts };
  fs.writeFileSync(result.paths.indexHTML, template.replace(/\{\{(title|scripts)\}\}/g, (_, key) => values[key]));
  options.md5CacheOptions.includes.push('index.js', 'style.css');
  options.md5CacheOptions.excludes.push('playable-runtime.js', 'config.json');
  options.md5CacheOptions.replaceOnly.push('index.html');
};
exports.onAfterBuild = async function (options, result) {
  const settings = readOptions(options);
  result.settings.plugins.jsList = result.settings.plugins.jsList.map(url => url.split('/').map(encodeURIComponent).join('/'));
  fs.writeFileSync(result.paths.settings, JSON.stringify(result.settings));
  fs.writeFileSync(path.join(result.paths.dir, 'config.json'), JSON.stringify({ Playable_orientation: orientations[settings.orientation] }));
  const report = await packageBuild(result.paths.dir);
  this.buildExitRes.custom = { ...(this.buildExitRes.custom || {}), playable: report };
  console.log('[Playable] TikTok ZIP: ' + report.archive);
};
