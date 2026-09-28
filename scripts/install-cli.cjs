'use strict';
const fs = require('node:fs');
const path = require('node:path');
const source = path.resolve(__dirname, '..');
const root = path.resolve(process.argv[2] || '');
if (!process.argv[2] || JSON.parse(fs.readFileSync(path.join(root, 'package.json'))).name !== 'cocos-cli') {
  throw new Error('Usage: node scripts/install-cli.cjs <cocos-cli-root>');
}
const target = path.join(root, 'packages/platforms/playable');
if (!fs.existsSync(path.join(source, 'dist/hooks.cjs'))) throw new Error('Run npm run build first');
for (const part of ['packages', 'packages/platforms', 'packages/platforms/playable']) {
  const dir = path.join(root, part);
  if (fs.existsSync(dir) && fs.lstatSync(dir).isSymbolicLink()) throw new Error('Refusing symlink destination: ' + dir);
}
if (fs.existsSync(target)) {
  const manifest = path.join(target, 'package.json');
  if (!fs.existsSync(manifest) || JSON.parse(fs.readFileSync(manifest)).name !== '@cocos/pal-playable') {
    throw new Error('Another plugin already owns ' + target);
  }
}
if (fs.realpathSync(source) === (fs.existsSync(target) ? fs.realpathSync(target) : target)) {
  console.log('Plugin is already in the CLI discovery directory: ' + target);
  process.exit(0);
}
fs.mkdirSync(target, { recursive: true });
fs.cpSync(path.join(source, 'dist'), path.join(target, 'dist'), { recursive: true });
for (const directory of ['static', 'i18n', 'docs']) {
  fs.cpSync(path.join(source, directory), path.join(target, directory), { recursive: true });
}
fs.mkdirSync(path.join(target, 'runtime'), { recursive: true });
fs.copyFileSync(path.join(source, 'runtime/playable.d.ts'), path.join(target, 'runtime/playable.d.ts'));
fs.copyFileSync(path.join(source, 'README.md'), path.join(target, 'README.md'));
const manifest = JSON.parse(fs.readFileSync(path.join(source, 'package.json')));
delete manifest.dependencies;
delete manifest.devDependencies;
delete manifest.scripts;
fs.writeFileSync(path.join(target, 'package.json'), JSON.stringify(manifest, null, 2));
console.log('Installed playable plugin: ' + target);
