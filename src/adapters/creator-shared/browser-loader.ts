import path from 'node:path';
import type { CreatorResult } from './delivery';

declare const Editor: { App: { path: string } };
interface ModuleSystem {
  build(options: { out: string; sourceMap: boolean; minify: boolean; platform: string; hmr: boolean }): Promise<unknown>;
}

export async function rebuildBrowserLoader(result: CreatorResult, debug?: boolean) {
  const output = result.paths.systemJs;
  if (!output) throw new Error('Creator Web SystemJS loader is missing');
  const moduleSystem = require(path.join(Editor.App.path, 'node_modules/@cocos/module-system')) as ModuleSystem;
  await moduleSystem.build({ out: output, sourceMap: false, minify: !debug, platform: 'web-mobile', hmr: false });
}
