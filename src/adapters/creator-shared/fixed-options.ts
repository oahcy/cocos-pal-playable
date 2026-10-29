import type { CreatorOptions } from './delivery';

/** Hidden controls may retain old Profile values; normalize before compiler initialization. */
export function applyFixedPlatformOptions(options: CreatorOptions): void {
  options.debug = false;
  options.sourceMaps = false;
  options.md5Cache = false;
  options.server = '';
  options.mainBundleIsRemote = false;
}
