import fs from 'node:fs';
import path from 'node:path';
import type { BuildContext, BuildOptions, BuildResult } from './builder-types';
import type { Channel } from '../../types';
import { readOptions } from './options';
import { renderPlayableTemplate } from '../../template';

export async function generatePlayableTemplate(context: BuildContext, options: BuildOptions, result: BuildResult, channel: Channel) {
  const files = await renderPlayableTemplate({
    root: result.paths.dir, applicationJS: result.paths.applicationJS,
    systemJs: result.paths.systemJs, importMap: result.paths.importMap, polyfillsJs: result.paths.polyfillsJs,
    title: options.name, orientation: readOptions(options).orientation,
  }, channel, source => context.utils.transformCode(source, { importMapFormat: 'systemjs' }));
  for (const file of files) fs.writeFileSync(path.join(result.paths.dir, file.name), file.data);
  result.paths.indexJs = path.join(result.paths.dir, 'index.js');
  result.paths.indexHTML = path.join(result.paths.dir, 'index.html');
}
