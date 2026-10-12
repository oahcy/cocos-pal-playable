import type { PackageOptions } from './options';
export interface BuildOptions {
  packages?: { playable?: { channel?: string; orientation?: string } & PackageOptions };
  sourceMaps?: boolean | string; server?: string; name?: string; debug?: boolean;
}
export interface InitializedOptions extends BuildOptions {
  appTemplateData: { showFPS: boolean };
  buildEngineParam: { split: boolean; assetURLFormat: string };
  buildScriptParam: { system: { preset: string }; flags: { WEBGPU: boolean } };
  includeModules: string[];
  md5CacheOptions: { includes: string[]; excludes: string[]; replaceOnly: string[] };
}
export interface BuildResult {
  paths: { dir: string; applicationJS: string; indexJs: string; indexHTML: string; polyfillsJs?: string; systemJs: string; importMap: string; settings: string };
  settings: { screen: { orientation: string }; assets: {server?: string; remoteBundles?: string[]}; plugins: {jsList: string[]} };
}
export interface BuildContext {
  utils: { transformCode(code: string, options: {importMapFormat: string}): Promise<string | undefined> };
  buildExitRes: {custom?: Record<string, unknown>};
}
