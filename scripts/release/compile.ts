import path from 'node:path';
import { execFileSync } from 'node:child_process';
import esbuild from 'esbuild';
import { builtinModules } from 'node:module';
import { projectRoot as root, selectProfile } from './profile';
export async function compilePlugin(output: string, profile = selectProfile()) {
  execFileSync(process.execPath, [require.resolve('typescript/bin/tsc'), '--noEmit', '-p', path.join(root, 'tsconfig.json')], { stdio: 'inherit' });
  await esbuild.build({
    entryPoints: ['config', 'hooks'].map(name => path.join(root, 'src/adapters', profile.adapter, name + '.ts')),
    outdir: path.join(output, 'dist'), outExtension: { '.js': '.cjs' },
    bundle: true, platform: 'node', target: profile.nodeTarget, format: 'cjs', external: profile.layout === 'creator-extension' ? profile.externalDependencies.filter(name => name !== 'sharp') : profile.externalDependencies,
    // Legacy Creator loaders resolve bare built-ins, but may reject the node: scheme.
    plugins: profile.layout === 'creator-extension' ? [{
      name: 'creator-node-builtins',
      setup(build) {
        build.onResolve({ filter: /^sharp$/ }, () => ({ path: path.join(root, 'src/adapters', profile.adapter, 'sharp.ts') }));
        build.onResolve({ filter: /^node:/ }, args => {
          const name = args.path.slice(5);
          if (!builtinModules.includes(name)) throw new Error('Unsupported Creator built-in: ' + args.path);
          return { path: name, external: true };
        });
      },
    }] : [],
    minify: true, sourcemap: false,
  });
  await esbuild.build({ entryPoints: ['en', 'zh'].map(name => path.join(root, 'i18n', name + '.ts')), outdir: path.join(output, 'i18n'), bundle: true, platform: 'node', format: 'cjs', banner: { js: '// Generated from TypeScript. Do not edit.' } });
  // Runtime is emitted as part of the distributable, never source-mapped.
  await esbuild.build({ entryPoints: [path.join(root, 'runtime/entries/tiktok.ts')],
    outfile: path.join(output, 'dist/playable-runtime.js'), bundle: true, platform: 'browser', format: 'iife', minify: true, target: 'es2017' });
  await esbuild.build({ entryPoints: [path.join(root, 'runtime/entries/google-ads.ts')],
    outfile: path.join(output, 'dist/google-ads-runtime.js'), bundle: true, platform: 'browser', format: 'iife', minify: true, target: 'es2017' });
  await esbuild.build({ entryPoints: [path.join(root, 'runtime/entries/single-html.ts')], outfile: path.join(output, 'dist/single-html-runtime.js'), bundle: true, platform: 'browser', format: 'iife', minify: true, target: 'es2017' });
}
