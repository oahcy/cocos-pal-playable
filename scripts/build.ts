import path from 'node:path';
import { execFileSync } from 'node:child_process';
import esbuild from 'esbuild';
const root = path.resolve(__dirname, '..');
(async () => {
  execFileSync(process.execPath, [require.resolve('typescript/bin/tsc'), '--noEmit', '-p', path.join(root, 'tsconfig.json')], { stdio: 'inherit' });
  await esbuild.build({
    entryPoints: ['config', 'hooks'].map(name => path.join(root, 'src', name + '.ts')),
    outdir: path.join(root, 'dist'), outExtension: { '.js': '.cjs' },
    bundle: true, platform: 'node', target: 'node22', format: 'cjs', external: ['sharp'],
    minify: true, sourcemap: false,
  });
  await esbuild.build({ entryPoints: ['en', 'zh'].map(name => path.join(root, 'i18n', name + '.ts')), outdir: path.join(root, 'i18n'), bundle: true, platform: 'node', format: 'cjs', banner: { js: '// Generated from TypeScript. Do not edit.' } });
  // Runtime is emitted as part of the distributable, never source-mapped.
  await esbuild.build({ entryPoints: [path.join(root, 'runtime/entries/tiktok.ts')],
    outfile: path.join(root, 'dist/playable-runtime.js'), bundle: true, platform: 'browser', format: 'iife', minify: true, target: 'es2017' });
  await esbuild.build({ entryPoints: [path.join(root, 'runtime/entries/google-ads.ts')],
    outfile: path.join(root, 'dist/google-ads-runtime.js'), bundle: true, platform: 'browser', format: 'iife', minify: true, target: 'es2017' });
  await esbuild.build({ entryPoints: [path.join(root, 'runtime/entries/single-html.ts')], outfile: path.join(root, 'dist/single-html-runtime.js'), bundle: true, platform: 'browser', format: 'iife', minify: true, target: 'es2017' });
})().catch(error => { console.error(error); process.exitCode = 1; });
