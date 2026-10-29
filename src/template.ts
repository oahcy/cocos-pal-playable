import fs from 'node:fs';
import path from 'node:path';
import Ejs from 'ejs';
import type { Channel, Entry, Orientation } from './types';
import { defaultResources, type PackagingResources } from './resources';

export interface TemplateInput {
  root: string;
  applicationJS: string;
  systemJs: string;
  importMap: string;
  polyfillsJs?: string;
  title?: string;
  orientation: Orientation;
  storeUrl?: string;
}
export type CompileBootstrap = (source: string) => Promise<string | undefined>;

/** Returns files without reading host options or mutating a host build result. */
export async function renderPlayableTemplate(input: TemplateInput, channel: Channel, compile: CompileBootstrap,
  resources: PackagingResources = defaultResources): Promise<Entry[]> {
  const url = (target: string) => {
    const relativePath = path.relative(input.root, target);
    // Encode each filename separately so spaces/# are safe without encoding directory slashes.
    const encodedSegments = relativePath.split(path.sep).map(encodeURIComponent);
    return './' + encodedSegments.join('/');
  };
  const bootstrap = await Ejs.renderFile(path.join(resources.runtime, 'bootstrap.ts.ejs'), {
    applicationURL: JSON.stringify(url(input.applicationJS)),
  });
  const transformed = await compile(bootstrap);
  if (!transformed) throw new Error('Could not compile playable bootstrap');
  const html = await Ejs.renderFile(path.join(resources.templates, 'index.ejs'), {
    title: input.title || 'Playable', sdkURL: channel.sdkURL,
    sdkPlacement: channel.sdkPlacement || 'body', headHTML: channel.headHTML?.(input) || '',
    polyfillsURL: input.polyfillsJs ? url(input.polyfillsJs) : '',
    systemURL: url(input.systemJs), importMapURL: url(input.importMap),
  });
  let channelRuntime = fs.readFileSync(path.join(resources.runtime, channel.runtimeFile || 'playable-runtime.js'));
  if (channel.requiresStoreUrl) {
    if (!input.storeUrl) throw new Error(channel.displayName + ' requires a store URL');
    // JSON encoding keeps user input out of executable syntax; HTML escaping happens at inlining.
    const config = 'window.__playableStoreUrl=' + JSON.stringify(input.storeUrl) + ';\n';
    channelRuntime = Buffer.concat([Buffer.from(config), channelRuntime]);
  }
  return [
    { name: 'index.js', data: Buffer.from(transformed) },
    { name: 'index.html', data: Buffer.from(html) },
    { name: 'playable-runtime.js', data: channelRuntime },
    { name: 'style.css', data: fs.readFileSync(path.join(resources.templates, 'style.css')) },
  ];
}
