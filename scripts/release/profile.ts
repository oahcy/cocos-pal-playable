import fs from 'node:fs';
import path from 'node:path';
export const projectRoot = path.resolve(__dirname, '../..');
export interface Profile {
  adapter: string; nodeTarget: string; runtime: string; layout: string; externalDependencies: string[];
  editorIntegration?: 'playable-platform';
  applicationAdapter: string;
}
interface CreatorPlatformGroup {
  name: string; from: string; to: string; profile: string | null; verifiedVersions: string[];
}
function compareVersions(left: string, right: string): number {
  const a = left.split('.').map(Number), b = right.split('.').map(Number);
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] - b[i];
  return 0;
}
interface Compatibility {
  schemaVersion: number;
  profiles: Record<string, Profile>;
  creatorVersions: Record<string, string>;
  creatorPlatformGroups: CreatorPlatformGroup[];
}
export function selectProfile(host = 'cli', creatorVersion?: string, root = projectRoot) {
  const config = JSON.parse(fs.readFileSync(path.join(root, 'compatibility.json'), 'utf8')) as Compatibility;
  if (config.schemaVersion !== 1) throw new Error('Unsupported compatibility schema');
  if (host !== 'cli' && host !== 'creator') throw new Error('Unsupported host: ' + host);
  if (host === 'cli' && creatorVersion) throw new Error('CLI does not accept Creator options');
  // Creator has a single entry: the standalone playable platform.
  const versions = config.creatorVersions;
  const id = host === 'cli' ? 'cli' : versions[creatorVersion || ''];
  if (!id || !Object.prototype.hasOwnProperty.call(config.profiles, id)) throw new Error('Creator version is not adapted: ' + creatorVersion);
  const profile = config.profiles[id];
  // Match OpenPaaS version families, while retaining the explicit release allowlist.
  // A reserved family without an implementation must never be shipped accidentally.
  if (host === 'creator' && profile.editorIntegration) {
    const groups = config.creatorPlatformGroups.filter(group =>
      compareVersions(creatorVersion!, group.from) >= 0 && compareVersions(creatorVersion!, group.to) <= 0);
    if (groups.length !== 1 || groups[0].profile !== id) throw new Error('Creator platform group mismatch: ' + creatorVersion);
  }
  const layout = host === 'cli' ? 'cli-platform' : 'creator-extension';
  const safeName = /^[a-z0-9][a-z0-9_-]*$/.test(profile.adapter);
  const required = host === 'creator' ? ['config.ts', 'hooks.ts', 'sharp.ts'] : ['config.ts', 'hooks.ts'];
  if (!safeName || profile.layout !== layout || profile.runtime !== 'systemjs'
    || !required.every(name => fs.existsSync(path.join(root, 'src/adapters', profile.adapter, name)))) {
    throw new Error('Adapter implementation is not available: ' + id);
  }
  const applicationDir = path.join(root, 'src/adapters', profile.applicationAdapter);
  if (!/^[a-z0-9][a-z0-9_-]*$/.test(profile.applicationAdapter)
    || !['runtime.ts', 'application.ts', 'bootstrap.ts.ejs'].every(name => fs.existsSync(path.join(applicationDir, name)))) {
    throw new Error('Application adapter is not available: ' + profile.applicationAdapter);
  }
  const artifactVersions = config.creatorVersions;
  const editor = host === 'creator'
    ? Object.keys(artifactVersions).filter(version => artifactVersions[version] === id).sort().join(' || ')
    : undefined;
  return { id, ...profile, editor };
}
