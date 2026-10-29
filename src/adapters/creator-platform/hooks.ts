import { applyFixedPlatformOptions } from '../creator-shared/fixed-options';
import path from 'node:path';
import { selectedChannels } from '../creator-shared/selection';
import { deliverCreatorChannels, validateDeliveryOptions, type CreatorOptions, type CreatorResult } from '../creator-shared/delivery';

interface Options extends CreatorOptions {
  debug?: boolean;
  appTemplateData: { showFPS: boolean };
  buildEngineParam: { split?: boolean; assetURLFormat?: string };
  buildScriptParam: { system?: { preset: string }; flags: Record<string, boolean>; hotModuleReload?: boolean };
  includeModules: string[];
}
interface Result extends CreatorResult {
  settings: { screen: { orientation?: string }; assets: { server?: string; remoteBundles?: string[] } };
  staticsInfo?: { orientation?: string };
}
declare const Editor: { App: { path: string } };
interface ModuleSystem {
  build(options: { out: string; sourceMap: boolean; minify: boolean; platform: string; hmr: boolean }): Promise<unknown>;
}

export const throwError = true;
function settings(options: CreatorOptions) {
  if (options.platform !== 'playable') throw new Error('Playable platform adapter requires platform=playable');
  return selectedChannels(options.packages?.playable);
}
export function onBeforeInit(options: CreatorOptions) {
  settings(options);
  applyFixedPlatformOptions(options);
  validateDeliveryOptions(options);
}
export function onAfterInit(options: Options, _result: Result) {
  options.appTemplateData.showFPS = false;
  options.buildEngineParam.split = false;
  options.buildEngineParam.assetURLFormat = 'runtime-resolved';
  // Preserve host orientation and statistics; channel settings belong to delivery only.
}
export function onAfterBundleInit(options: Options) {
  options.buildScriptParam.system = { preset: 'web' };
  options.buildScriptParam.flags.WEBGPU = false;
  const index = options.includeModules.indexOf('gfx-webgpu');
  if (index >= 0) options.includeModules.splice(index, 1);
}
export function onBeforeCompressSettings(_options: Options, result: Result) {
  if (result.settings.assets.server || result.settings.assets.remoteBundles?.length) {
    throw new Error('Remote bundles are not supported in playable builds');
  }
}
/**
 * Creator 3.8.3–3.8.9 module-system selects a browser loader by built-in platform name.
 * Rebuild only this output with the host's Web loader after the script stage.
 * Keep the task platform=playable; do not patch Creator or change global compiler state.
 */
export async function onBeforeCopyBuildTemplate(options: Options, result: CreatorResult) {
  settings(options);
  const output = result.paths.systemJs;
  if (!output) throw new Error('Creator Web SystemJS loader is missing');
  const moduleSystem = require(path.join(Editor.App.path, 'node_modules/@cocos/module-system')) as ModuleSystem;
  await moduleSystem.build({ out: output, sourceMap: false, minify: !options.debug, platform: 'web-mobile', hmr: false });
}
// Creator's shared stages generate application.js, settings, import map and assets.
// This platform supplies the final HTML/JS/CSS and channel SDK through the shared delivery layer.
export async function onAfterBuild(options: CreatorOptions, result: CreatorResult) {
  return deliverCreatorChannels(options, result, settings(options));
}
