import fs from 'node:fs';
import path from 'node:path';
import Ejs from 'ejs';
import type { BuildContext, BuildOptions, BuildResult } from './builder-types';
import type { Channel } from './types';
import { readOptions } from './options';

export async function generatePlayableTemplate(context: BuildContext, options: BuildOptions, result: BuildResult, channel: Channel) {
  const root = result.paths.dir;
  const url = (target: string) => './' + path.relative(root, target).split(path.sep).map(encodeURIComponent).join('/');
  const templateDir = path.join(__dirname, '../static/templates');
  const bootstrap = await Ejs.renderFile(path.join(templateDir, 'index.ts.ejs'), {
    applicationURL: JSON.stringify(url(result.paths.applicationJS)),
  });
  const transformed = await context.utils.transformCode(bootstrap, { importMapFormat: 'systemjs' });
  if (!transformed) throw new Error('Could not compile playable bootstrap');
  result.paths.indexJs = path.join(root, 'index.js');
  result.paths.indexHTML = path.join(root, 'index.html');
  fs.writeFileSync(result.paths.indexJs, transformed);
  fs.copyFileSync(path.join(__dirname, channel.runtimeFile || 'playable-runtime.js'), path.join(root, 'playable-runtime.js'));
  fs.copyFileSync(path.join(templateDir, 'style.css'), path.join(root, 'style.css'));
  fs.writeFileSync(result.paths.indexHTML, await Ejs.renderFile(path.join(templateDir, 'index.ejs'), {
    title: options.name || 'Playable',
    sdkURL: channel.sdkURL,
    sdkPlacement: channel.sdkPlacement || 'body',
    headHTML: channel.headHTML?.(readOptions(options)) || '',
    polyfillsURL: result.paths.polyfillsJs ? url(result.paths.polyfillsJs) : '',
    systemURL: url(result.paths.systemJs),
    importMapURL: url(result.paths.importMap),
  }));
}
