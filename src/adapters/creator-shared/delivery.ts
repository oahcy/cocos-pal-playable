import { applicationAdapter } from '@playable/host-application';
import fs from 'node:fs';
import path from 'node:path';
import type { CreatorPlayableOptions } from './selection';
import type { Entry, PackageReport } from '../../types';
import { getChannel } from '../../channel';
import { renderPlayableTemplate } from '../../template';
import { packageBuild } from '../../package';
import type { normalizeOptions } from '../../options';

export interface CreatorOptions {
  name?: string;
  platform: string;
  debug?: boolean;
  mainBundleIsRemote?: boolean;
  sourceMaps?: boolean | string;
  server?: string;
  md5Cache?: boolean;
  packages?: { playable?: CreatorPlayableOptions };
}
export interface CreatorResult {
  paths: { dir: string; applicationJS: string; systemJs?: string; importMap: string; polyfillsJs?: string; settings: string };
}
declare const Build: { Utils: { transformCode(source: string, options: { importMapFormat: string }): Promise<string> } };

export function validateDeliveryOptions(options: CreatorOptions) {
  if (options.md5Cache) throw new Error('Disable MD5 Cache for the Creator playable adapter');
  if (options.server) throw new Error('Playable does not support an external asset server');
  if (options.sourceMaps && options.sourceMaps !== 'false') throw new Error('Disable Source Maps before building a playable');
}

/** Creator version adapters share final-path handling and packaging without modifying Web inputs. */
async function prepareCreatorFiles(options: CreatorOptions, result: CreatorResult, selected: ReturnType<typeof normalizeOptions>): Promise<Entry[]> {
  validateDeliveryOptions(options);
  const paths = result.paths;
  if (!paths.systemJs) throw new Error('Creator Web SystemJS loader is missing');
  const channel = getChannel(selected.channel);
  const files = await renderPlayableTemplate({
    root: paths.dir, applicationJS: paths.applicationJS, systemJs: paths.systemJs,
    importMap: paths.importMap, polyfillsJs: paths.polyfillsJs,
    title: options.name, orientation: selected.orientation, storeUrl: selected.storeUrl,
  }, channel, source => Build.Utils.transformCode(source, { importMapFormat: 'systemjs' }));
  const config = JSON.parse(fs.readFileSync(paths.settings, 'utf8'));
  applicationAdapter.prepareSettings(config, selected);
  files.push({ name: path.relative(paths.dir, paths.applicationJS).split(path.sep).join('/'),
    data: Buffer.from(applicationAdapter.prepareApplication(fs.readFileSync(paths.applicationJS, 'utf8'))) });
  files.push({ name: path.relative(paths.dir, paths.settings).split(path.sep).join('/'), data: Buffer.from(JSON.stringify(config)) });
  for (const file of channel.createFiles(selected)) files.push({ name: file.name, data: Buffer.from(file.data) });
  return files;
}

/** One engine build, independent channel inputs and delivery reports. */
export async function deliverCreatorChannels(options: CreatorOptions, result: CreatorResult, selections: ReturnType<typeof normalizeOptions>[]) {
  const reports: PackageReport[] = [];
  const failures: string[] = [];
  for (const selected of selections) {
    try {
      const report = await packageBuild(result.paths.dir, selected.channel, selected, {
        prepareOverrides: () => prepareCreatorFiles(options, result, selected),
      });
      reports.push(report);
      console.log('[Playable] ' + report.archive);
    } catch (error) {
      const message = selected.channel + ': ' + (error instanceof Error ? error.message : String(error));
      failures.push(message);
      console.error('[Playable] ' + message);
    }
  }
  if (failures.length) throw new Error('Playable channels failed:\n' + failures.join('\n'));
  return reports;
}
