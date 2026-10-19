import fs from 'node:fs';
import path from 'node:path';
import { normalizeOptions, type PlayableOptions } from '../../options';
import { getChannel } from '../../channel';
import { renderPlayableTemplate } from '../../template';
import { packageBuild } from '../../package';

interface Options {
  name?: string;
  platform: string;
  sourceMaps?: boolean | string;
  server?: string;
  md5Cache?: boolean;
  packages?: { playable?: PlayableOptions & { enabled?: boolean } };
}
interface Result {
  paths: { dir: string; applicationJS: string; systemJs?: string; importMap: string; polyfillsJs?: string; settings: string };
}
declare const Build: { Utils: { transformCode(source: string, options: { importMapFormat: string }): Promise<string> } };
export const throwError = true;
function settings(options: Options) {
  if (!options.packages?.playable?.enabled) return;
  if (options.platform !== 'web-mobile') throw new Error('Creator playable requires web-mobile');
  return normalizeOptions(options.packages.playable);
}
export function onBeforeBuild(options: Options) {
  if (!settings(options)) return;
  if (options.md5Cache) throw new Error('Disable MD5 Cache for the initial Creator playable adapter');
  if (options.server) throw new Error('Playable does not support an external asset server');
  if (options.sourceMaps && options.sourceMaps !== 'false') throw new Error('Disable Source Maps before building a playable');
}
// Use final paths after Creator has applied hashes and copied its Web templates.
export async function onAfterBuild(options: Options, result: Result) {
  const selected = settings(options);
  if (!selected) return;
  onBeforeBuild(options);
  const paths = result.paths;
  if (!paths.systemJs) throw new Error('Creator Web SystemJS loader is missing');
  const channel = getChannel(selected.channel);
  const files = await renderPlayableTemplate({
    root: paths.dir, applicationJS: paths.applicationJS, systemJs: paths.systemJs,
    importMap: paths.importMap, polyfillsJs: paths.polyfillsJs,
    title: options.name, orientation: selected.orientation,
  }, channel, source => Build.Utils.transformCode(source, { importMapFormat: 'systemjs' }));
  const config = JSON.parse(fs.readFileSync(paths.settings, 'utf8'));
  if (config.assets?.server || config.assets?.remoteBundles?.length) throw new Error('Remote bundles are not supported in playable builds');
  config.screen = { ...config.screen, orientation: selected.orientation };
  config.profiling = { ...config.profiling, showFPS: false };
  fs.writeFileSync(paths.settings, JSON.stringify(config));
  for (const file of files) fs.writeFileSync(path.join(paths.dir, file.name), file.data);
  for (const file of channel.createFiles(selected)) fs.writeFileSync(path.join(paths.dir, file.name), file.data);
  const report = await packageBuild(paths.dir, channel.id, selected);
  console.log('[Playable] ' + report.archive);
  return report;
}
