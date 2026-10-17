import type { BuildOptions, InitializedOptions, BuildResult, BuildContext } from './builder-types';
import fs from 'node:fs';
import path from 'node:path';
import { getChannel } from '../../channel';
import { readOptions } from './options';
import { generatePlayableTemplate } from './template';
import { packageBuild } from '../../package';
export const throwError = true;
export function onBeforeInit(options: BuildOptions) {
  readOptions(options);
  if (options.server) throw new Error('Playable does not support an external asset server');
  // CLI defaults or saved project settings may enable inline maps; normalize before compiler parameters are initialized.
  if (options.sourceMaps && options.sourceMaps !== 'false') {
    console.info('[Playable] Disabled source maps for advertisement delivery.');
  }
  options.sourceMaps = false;
};
export function onAfterInit(options: InitializedOptions) {
  // Hide the delivery overlay without changing the project debug compilation option.
  options.appTemplateData.showFPS = false;
  options.buildEngineParam.split = false;
  options.buildEngineParam.assetURLFormat = 'runtime-resolved';
};
export function onAfterBundleInit(options: InitializedOptions) {
  options.buildScriptParam.system = { preset: 'web' };
  options.buildScriptParam.flags.WEBGPU = false;
  const index = options.includeModules.indexOf('gfx-webgpu');
  if (index >= 0) options.includeModules.splice(index, 1);
};
export function onBeforeCompressSettings(options: BuildOptions, result: BuildResult) {
  result.settings.screen.orientation = readOptions(options).orientation;
  if (result.settings.assets.server || result.settings.assets.remoteBundles?.length) {
    throw new Error('Remote bundles are not supported in playable builds');
  }
};
export async function onBeforeCopyBuildTemplate(this: BuildContext, options: InitializedOptions, result: BuildResult) {
  const channel = getChannel(readOptions(options).channel);
  await generatePlayableTemplate(this, options, result, channel);
  options.md5CacheOptions.includes.push('index.js', 'style.css');
  options.md5CacheOptions.excludes.push('playable-runtime.js', ...channel.extraRootFiles);
  options.md5CacheOptions.replaceOnly.push('index.html');
};
export async function onAfterBuild(this: BuildContext, options: BuildOptions, result: BuildResult) {
  const settings = readOptions(options);
  result.settings.plugins.jsList = result.settings.plugins.jsList.map(url => url.split('/').map(encodeURIComponent).join('/'));
  fs.writeFileSync(result.paths.settings, JSON.stringify(result.settings));
  const channel = getChannel(settings.channel);
  for (const file of channel.createFiles(settings)) {
    fs.writeFileSync(path.join(result.paths.dir, file.name), file.data);
  }
  const report = await packageBuild(result.paths.dir, channel.id, settings);
  this.buildExitRes.custom = { ...(this.buildExitRes.custom || {}), playable: report };
  console.log('[Playable] ' + channel.displayName + ' ' + report.packageFormat + ': ' + report.archive);
};
