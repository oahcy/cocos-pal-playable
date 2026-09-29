export type Orientation = 'auto' | 'portrait' | 'landscape';
export interface ImageOptions { imageCompression?: 'none' | 'lossy'; imageQuality?: number }
export interface ImageReport {
  mode: 'none' | 'lossy'; quality: number;
  files: Array<{ path: string; before: number; after: number; status: 'compressed' | 'kept'; reason?: string }>;
}
export interface Entry { name: string; data: Buffer }
export interface Channel {
  id: string; displayName: string; sdkURL: string; packageFormat: string; resourceMode: string;
  archiveName: string; maxBytesExclusive: number; extraRootFiles: string[]; pending: string[];
  createFiles(options: { orientation: string }): Array<{name: string; data: string}>;
  allowsReference(from: string, value: string): boolean;
  validate(entries: Entry[]): void;
}
export interface BuildOptions {
  packages?: { playable?: { channel?: string; orientation?: string } & ImageOptions };
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
export interface PackageReport {
  channel: string; status: string; archive: string; maxBytesExclusive: number; verification: string; pending: string[];
  images?: ImageReport; bytes?: number; files?: Array<{path: string; bytes: number}>; sha256?: string; error?: string;
}
