import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
// Preserve the installed production dependency graph, including native binaries.
// Keep nested versions; flattening can silently change dependency resolution.
export function copyDependencies(names: string[], source: string, destination: string) {
  function copy(name: string, from: string, parent: string, ancestors: Map<string, string>) {
    const requireFrom = createRequire(path.join(from, 'package.json'));
    let manifest: string;
    try { manifest = requireFrom.resolve(name + '/package.json'); }
    catch {
      let dir = path.dirname(requireFrom.resolve(name));
      while (!fs.existsSync(path.join(dir, 'package.json')) || JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8')).name !== name) {
        const parent = path.dirname(dir); if (parent === dir) throw new Error('Cannot locate dependency: ' + name); dir = parent;
      }
      manifest = path.join(dir, 'package.json');
    }
    const folder = path.dirname(manifest), pkg = JSON.parse(fs.readFileSync(manifest, 'utf8'));
    if (ancestors.get(name) === folder) return;
    const target = path.join(parent, 'node_modules', name);
    const nextAncestors = new Map(ancestors).set(name, folder);
    fs.cpSync(folder, target, { recursive: true,
      filter: file => !path.relative(folder, file).split(path.sep).some(part => ['node_modules', '.git', 'test', 'tests'].includes(part)) });
    for (const dependency of Object.keys(pkg.dependencies || {})) copy(dependency, folder, target, nextAncestors);
    for (const dependency of Object.keys(pkg.optionalDependencies || {})) {
      try { requireFrom.resolve(dependency); } catch { continue; }
      copy(dependency, folder, target, nextAncestors);
    }
  }
  for (const name of names) copy(name, source, destination, new Map());
}
