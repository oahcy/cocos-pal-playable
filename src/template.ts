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
}
export type CompileBootstrap = (source: string) => Promise<string | undefined>;

/** Returns files without reading host options or mutating a host build result. */
export async function renderPlayableTemplate(input: TemplateInput, channel: Channel, compile: CompileBootstrap,
  resources: PackagingResources = defaultResources): Promise<Entry[]> {
  const url = (target: string) => './' + path.relative(input.root, target).split(path.sep).map(encodeURIComponent).join('/');
  const bootstrap = await Ejs.renderFile(path.join(resources.templates, 'index.ts.ejs'), {
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
  return [
    { name: 'index.js', data: Buffer.from(transformed) },
    { name: 'index.html', data: Buffer.from(html) },
    { name: 'playable-runtime.js', data: fs.readFileSync(path.join(resources.runtime, channel.runtimeFile || 'playable-runtime.js')) },
    { name: 'style.css', data: fs.readFileSync(path.join(resources.templates, 'style.css')) },
  ];
}
