'use strict';
const path = require('node:path');
const fs = require('node:fs');
const esbuild = require('esbuild');
const root = path.resolve(__dirname, '..');
(async () => {
  await esbuild.build({
    entryPoints: ['config', 'hooks'].map(name => path.join(root, 'src', name + '.cjs')),
    outdir: path.join(root, 'dist'), outExtension: { '.js': '.cjs' },
    bundle: true, platform: 'node', target: 'node22', format: 'cjs',
    minify: true, sourcemap: false,
  });
  // Runtime is emitted as part of the distributable, never source-mapped.
  await esbuild.build({ entryPoints: [path.join(root, 'runtime/playable.js')],
    outfile: path.join(root, 'dist/playable-runtime.js'), minify: true, target: 'es2017' });
})().catch(error => { console.error(error); process.exitCode = 1; });
