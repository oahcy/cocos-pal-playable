import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import esbuild from 'esbuild';
import { builtinModules } from 'node:module';
import { projectRoot as root, selectProfile } from './profile';
export async function compilePlugin(output: string, profile = selectProfile()) {
  execFileSync(process.execPath, [require.resolve('typescript/bin/tsc'), '--noEmit', '-p', path.join(root, 'tsconfig.json')], { stdio: 'inherit' });
  const applicationDir = path.join(root, 'src/adapters', profile.applicationAdapter);
  await esbuild.build({
    alias: { '@playable/host-application': path.join(applicationDir, 'application.ts') },
    entryPoints: ['config', 'hooks'].map(name => path.join(root, 'src/adapters', profile.adapter, name + '.ts')),
    outdir: path.join(output, 'dist'), outExtension: { '.js': profile.entryExtension },
    bundle: true, platform: 'node', target: profile.nodeTarget, format: 'cjs', external: profile.layout !== 'cli-platform' ? profile.externalDependencies.filter(name => name !== 'sharp') : profile.externalDependencies,
    // Legacy Creator loaders resolve bare built-ins, but may reject the node: scheme.
    plugins: profile.layout !== 'cli-platform' ? [{
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
  if (profile.editorIntegration) await compileCreatorPanel(output, profile);
  await esbuild.build({ entryPoints: ['en', 'zh'].map(name => path.join(root, 'i18n', name + '.ts')), outdir: path.join(output, 'i18n'), bundle: true, platform: 'node', format: 'cjs', banner: { js: '// Generated from TypeScript. Do not edit.' } });
  // Emit only the selected adapter's bootstrap and browser implementation.
  fs.copyFileSync(path.join(applicationDir, 'bootstrap.ts.ejs'), path.join(output, 'dist/bootstrap.ts.ejs'));
  // SDK entries are shared. Only the host application's startup protocol differs.
  const runtimes = { tiktok: 'playable-runtime', 'google-ads': 'google-ads-runtime', applovin: 'applovin-runtime', 'single-html': 'single-html-runtime' };
  for (const [entry, outputName] of Object.entries(runtimes)) {
    await esbuild.build({
      entryPoints: [path.join(root, 'runtime/entries', entry + '.ts')],
      outfile: path.join(output, 'dist', outputName + '.js'), bundle: true,
      platform: 'browser', format: 'iife', minify: true, target: 'es2017',
      alias: { '@playable/host-runtime': path.join(applicationDir, 'runtime.ts') },
    });
  }
}

/** Production and browser regression must compile the same panel entry with the same options. */
export async function compileCreatorPanel(output: string, profile: ReturnType<typeof selectProfile>) {
  if (!profile.editorIntegration) throw new Error('Creator panel compilation requires a Creator profile');
  const outfile = path.join(output, 'dist/panel' + profile.entryExtension);
  await esbuild.build({
    entryPoints: [path.join(root, 'src/adapters', profile.editorIntegration === 'simple-build-target' ? 'creator-2x' : 'creator-platform', 'panel.ts')],
    outfile, bundle: true, platform: 'node',
    format: 'cjs', target: profile.nodeTarget, minify: true, sourcemap: false,
  });
  return outfile;
}
