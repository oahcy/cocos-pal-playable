import fs from 'node:fs';
import path from 'node:path';
import Ejs from 'ejs';
import { build } from 'esbuild';
import { channelIds, getChannel } from '../src/channel';
import { normalizeOptions } from '../src/options';
import { validate } from '../src/packaging/web-files';
import encodeDirectoryZip from '../src/packaging/directory-zip';
import type { Entry } from '../src/types';

async function main() {
  const root = path.resolve(__dirname, '..');
  const source = path.join(root, 'examples/sdk-demo');
  let configFile = path.join(source, 'config.json');
  let outputOverride: string | undefined;
  let channels = channelIds;
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith('--config=')) configFile = path.resolve(arg.slice(9));
    else if (arg.startsWith('--out=')) outputOverride = arg.slice(6);
    else if (arg.startsWith('--channel=')) channels = [arg.slice(10)];
    else throw new Error('Unknown argument: ' + arg);
  }
  const config = JSON.parse(fs.readFileSync(configFile, 'utf8')) as {
    title: string; storeUrl: string; outputDirectory: string;
  };
  if (typeof config.title !== 'string' || !config.title.trim()) throw new Error('SDK demo config requires a title');
  if (typeof config.storeUrl !== 'string') throw new Error('SDK demo config requires storeUrl');
  if (typeof config.outputDirectory !== 'string' || !config.outputDirectory.trim()) throw new Error('SDK demo config requires outputDirectory');
  const output = path.resolve(root, outputOverride ?? config.outputDirectory);
  for (const id of channels) {
    const channel = getChannel(id);
    const options = normalizeOptions({ channel: id, storeUrl: config.storeUrl });
    const bundle = await build({
      entryPoints: [path.join(source, id + '.ts')],
      bundle: true, write: false, minify: true, platform: 'browser', format: 'iife', target: 'es2017',
      define: { __PLAYABLE_STORE_URL__: JSON.stringify(options.storeUrl || '') },
    });
    const runtime = bundle.outputFiles[0].text;
    const data = {
      title: config.title, channelName: channel.displayName, sdkURL: channel.sdkURL,
      sdkPlacement: channel.sdkPlacement || 'body',
      headHTML: channel.headHTML?.(options) || '',
      runtimeCode: null as string | null,
    };
    const template = path.join(source, 'index.ejs');
    const html = await Ejs.renderFile(template, data);
    const entries: Entry[] = [
      { name: 'index.html', data: Buffer.from(html) },
      { name: 'playable-runtime.js', data: Buffer.from(runtime) },
      ...channel.createFiles(options).map(file => ({ name: file.name, data: Buffer.from(file.data) })),
    ];
    // Apply the same SDK placement, orientation and local-reference checks as game builds.
    validate(entries, channel);

    let artifact: Buffer;
    if (channel.packageFormat === 'single-html') {
      // This SDK-only page has no engine/resources to embed. Inline its one runtime.
      data.runtimeCode = runtime.replace(/<\/script/gi, '<\\/script');
      artifact = Buffer.from(await Ejs.renderFile(template, data));
    } else if (channel.packageFormat === 'directory-zip') {
      artifact = await encodeDirectoryZip(entries);
    } else {
      throw new Error('Unsupported SDK demo format: ' + channel.packageFormat);
    }
    if (artifact.length >= channel.maxBytesExclusive) throw new Error('SDK demo exceeds channel size limit: ' + id);
    if (channel.maxFiles !== undefined && entries.length > channel.maxFiles) throw new Error('SDK demo exceeds channel file count: ' + id);
    const directory = path.join(output, 'playable-' + id);
    fs.mkdirSync(directory, { recursive: true });
    const archive = path.join(directory, channel.archiveName);
    fs.writeFileSync(archive, artifact);
    console.log('[SDK demo] ' + id + ' ' + archive + ' (' + artifact.length + ' bytes)');
  }
  if (channels.includes('applovin')) console.log('[SDK demo] AppLovin store URL: ' + config.storeUrl);
}
void main().catch(error => { console.error(error); process.exitCode = 1; });
