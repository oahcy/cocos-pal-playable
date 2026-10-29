import fs from 'node:fs';
import path from 'node:path';
import Ejs from 'ejs';
import { selectedChannels } from '../creator-shared/selection';
import { packageBuild } from '../../package';
import { defaultResources } from '../../resources';
import { getChannel } from '../../channel';
import type { Entry } from '../../types';
import type { CreatorPlayableOptions } from '../creator-shared/selection';
declare const Editor: { Profile: { load(path: string): { getSelfData(): CreatorPlayableOptions } } };
interface Options { actualPlatform?: string; platform?: string; dest: string; debug?: boolean; md5Cache?: boolean; sourceMaps?: boolean; encryptJs?: boolean; embedWebDebugger?: boolean; bundles?: Array<{ isRemote?: boolean }> }
function selections() { return selectedChannels(Editor.Profile.load('project://playable.json').getSelfData()); }
export function buildStart(options: Options): void {
  if (options.actualPlatform && options.actualPlatform !== 'playable') throw new Error('Creator 2 adapter requires actualPlatform=playable');
  selections();
  options.debug = false; options.md5Cache = false; options.sourceMaps = false; options.encryptJs = false; options.embedWebDebugger = false;
}
export async function deliverCreator2(options: Options): Promise<unknown[]> {
  const root = fs.realpathSync(options.dest);
  if (options.bundles?.some(bundle => bundle.isRemote)) throw new Error('Remote bundles are not supported in playable builds');
  const names = fs.readdirSync(root);
  const engines = names.filter(name => /^cocos2d-js(?:-min)?\.js$/.test(name));
  if (engines.length !== 1) throw new Error('Expected one Creator 2 Web engine');
  for (const name of ['src/settings.js', 'main.js']) if (!fs.existsSync(path.join(root, name))) throw new Error('Missing Creator 2 Web input: ' + name);
  const rawSettings = fs.readFileSync(path.join(root, 'src/settings.js'), 'utf8');
  const match = /^\s*window\._CCSettings\s*=\s*([\s\S]*?)\s*;?\s*$/.exec(rawSettings);
  if (!match) throw new Error('Unsupported Creator 2 settings script');
  // Host-generated settings must be JSON; never execute project JS in the build worker.
  const settings = JSON.parse(match[1]);
  if (settings.server || settings.remoteBundles?.length) throw new Error('Remote settings are not supported in playable builds');
  const physics = names.filter(name => /^physics(?:-min)?\.js$/.test(name));
  if (physics.length > 1) throw new Error('Ambiguous Creator 2 physics scripts');
  const manifest = { kind: 'creator2', entry: 'index.js', engine: engines[0], main: 'main.js', scripts: ['src/settings.js', engines[0], ...physics, 'main.js'] };
  const reports: unknown[] = [], errors: string[] = [];
  for (const selected of selections()) {
    try {
      reports.push(await packageBuild(root, selected.channel, selected, { prepareOverrides: async () => {
        const channel = getChannel(selected.channel);
        const html = await Ejs.renderFile(path.join(defaultResources.templates, 'creator2.ejs'), {
          sdkURL: channel.sdkURL, sdkPlacement: channel.sdkPlacement || 'body', headHTML: channel.headHTML?.(selected) || '',
        });
        let runtime = fs.readFileSync(path.join(defaultResources.runtime, channel.runtimeFile || 'playable-runtime.js'));
        if (channel.requiresStoreUrl) runtime = Buffer.concat([Buffer.from('window.__playableStoreUrl=' + JSON.stringify(selected.storeUrl) + ';\n'), runtime]);
        const entries: Entry[] = [
          { name: 'index.html', data: Buffer.from(html) },
          { name: 'index.js', data: Buffer.from('window.__startCreator2(' + JSON.stringify(manifest) + ');') },
          { name: 'playable-runtime.js', data: runtime },
          { name: 'style.css', data: fs.readFileSync(path.join(defaultResources.templates, 'style.css')) },
          { name: 'src/settings.js', data: Buffer.from('window._CCSettings=' + JSON.stringify({ ...settings, orientation: selected.orientation, debug: false }) + ';') },
          { name: 'creator2-manifest.json', data: Buffer.from(JSON.stringify(manifest)) },
        ];
        for (const file of channel.createFiles(selected)) entries.push({ name: file.name, data: Buffer.from(file.data) });
        return entries;
      } }));
    } catch (error) { errors.push(selected.channel + ': ' + String(error)); }
  }
  if (errors.length) throw new Error(errors.join('\n'));
  return reports;
}
export async function buildFinished(event: { reply(error?: Error | null): void }, options: Options): Promise<void> {
  try { await deliverCreator2(options); event.reply(); }
  catch (error) { event.reply(error instanceof Error ? error : new Error(String(error))); }
}
