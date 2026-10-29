import { applyFixedPlatformOptions } from '../creator-shared/fixed-options';
import path from 'node:path';
import { selectedChannels } from '../creator-shared/selection';
import { deliverCreatorChannels, validateDeliveryOptions, type CreatorOptions, type CreatorResult } from '../creator-shared/delivery';

interface Options extends CreatorOptions {
  debug?: boolean;
  packages: NonNullable<CreatorOptions['packages']> & { 'web-mobile'?: { orientation?: string } };
  appTemplateData: { showFPS: boolean };
  buildEngineParam: { platform?: string; ammoJsWasm?: boolean; split?: boolean; assetURLFormat?: string };
  buildScriptParam: { system?: { preset: string } };
}
type HostHook = (this: unknown, options: Options, result: CreatorResult, cache: unknown) => unknown;
declare const Editor: { App: { path: string }; Module: { requireFile(file: string): { onAfterInit: HostHook; onAfterBuild: HostHook } } };
function webHooks() {
  // Use the installed version's Web templates and loader, like the openpaas adapter.
  const candidates = [
    'modules/platform-extensions/extensions/web-mobile/dist/builder/hooks.ccc',
    'modules/platform-extensions/extensions/web-mobile/dist/builder/hooks.js',
    'builtin/web-mobile/dist/builder/hooks.ccc',
    'builtin/web-mobile/dist/builder/hooks.js',
  ];
  const errors: string[] = [];
  for (const relative of candidates) {
    try { return Editor.Module.requireFile(path.join(Editor.App.path, relative)); }
    catch (error) { errors.push(relative + ': ' + String(error)); }
  }
  throw new Error('Creator Web hooks are unavailable: ' + errors.join('; '));
}
function selections(options: CreatorOptions) {
  if (options.platform !== 'playable') throw new Error('Playable platform adapter requires platform=playable');
  return selectedChannels(options.packages?.playable);
}
export const throwError = true;
export function onBeforeInit(options: CreatorOptions & { debug?: boolean }) {
  selections(options);
  applyFixedPlatformOptions(options);
  validateDeliveryOptions(options);
}
export async function onAfterInit(this: unknown, options: Options, result: CreatorResult, cache: unknown) {
  options.packages['web-mobile'] = { orientation: 'auto', ...options.packages['web-mobile'] };
  await webHooks().onAfterInit.call(this, options, result, cache);
  options.appTemplateData.showFPS = false;
  Object.assign(options.buildEngineParam, { platform: 'HTML5', ammoJsWasm: false, split: false, assetURLFormat: 'runtime-resolved' });
  // 3.5 has no onAfterBundleInit; set the browser script preset here.
  options.buildScriptParam.system = { preset: 'web' };
}
export async function onAfterBuild(this: unknown, options: Options, result: CreatorResult, cache: unknown) {
  const channels = selections(options);
  // The host hook populates application/importMap/settings paths and renders its templates.
  await webHooks().onAfterBuild.call(this, options, result, cache);
  return deliverCreatorChannels(options, result, channels);
}
