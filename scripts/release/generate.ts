import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { compilePlugin } from './compile';
import { projectRoot, selectProfile } from './profile';
import { copyDependencies } from './dependencies';
import { hash, readFiles, releaseFile, verifyFiles } from './files';
export async function generatePlugin(output: string, host = 'cli', creatorVersion?: string) {
  const profile = selectProfile(host, creatorVersion, projectRoot);
  if (fs.existsSync(output)) throw new Error('Output already exists; choose a fresh directory: ' + output);
  fs.mkdirSync(output, { recursive: true });
  await compilePlugin(output, profile);
  for (const name of ['static', 'docs']) fs.cpSync(path.join(projectRoot, name), path.join(output, name), { recursive: true });
  fs.mkdirSync(path.join(output, 'runtime'));
  fs.copyFileSync(path.join(projectRoot, 'runtime/playable.d.ts'), path.join(output, 'runtime/playable.d.ts'));
  fs.copyFileSync(path.join(projectRoot, 'README.md'), path.join(output, 'README.md'));
  const source = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));
  const { name, version, description, license, type, contributes } = source;
  fs.writeFileSync(path.join(output, 'package.json'), JSON.stringify(host === 'creator'
    ? { name: 'playable', version, description, license, editor: profile.editor, engines: { creator: profile.editor }, title: 'Playable',
      ...(profile.editorIntegration === 'simple-build-target'
        ? { 'simple-build-target': './dist/config.cjs', profiles: { project: { channels: null } } }
        : { package_version: 2, contributions: { builder: './dist/config.cjs' } }) }
    : { name, version, description, license, type, contributes }, null, 2));
  const dependencies = host === 'creator'
    ? [...profile.externalDependencies.filter(name => name !== 'sharp'), ...(profile.bundledSharp ? [profile.bundledSharp] : [])]
    : profile.externalDependencies;
  copyDependencies(dependencies, projectRoot, output);
  // Smoke-test from the output itself; no dependency fallback into this source tree.
  const sharpDependency = host === 'creator' ? profile.bundledSharp : 'sharp';
  const nativeSmoke = sharpDependency
    ? `require(p+'/node_modules/${sharpDependency}')({create:{width:2,height:2,channels:4,background:'#fff'}}).webp({quality:80}).toBuffer().catch(e=>{console.error(e);process.exitCode=1})`
    : '';
  execFileSync(process.execPath, ['-e', `const p=process.cwd(); require(p+'/dist/config.cjs'); require(p+'/dist/hooks.cjs'); ${nativeSmoke}`], { cwd: output, stdio: 'pipe', env: { ...process.env, NODE_PATH: '' } });
  const files = Object.fromEntries([...readFiles(output)].map(([name, data]) => [name, hash(data)]));
  fs.writeFileSync(path.join(output, releaseFile), JSON.stringify({ schemaVersion: 1, pluginVersion: version, host, profile: profile.id, nodeTarget: profile.nodeTarget, ...(profile.editorIntegration ? { editorIntegration: profile.editorIntegration } : {}), platform: process.platform, arch: process.arch, files }, null, 2));
  verifyFiles(readFiles(output));
  return output;
}
