import fs from 'node:fs';
import path from 'node:path';
export const projectRoot = path.resolve(__dirname, '../..');
export interface Profile { adapter: string; nodeTarget: string; runtime: string; layout: string; externalDependencies: string[] }
interface Compatibility { schemaVersion: number; profiles: Record<string, Profile>; creatorVersions: Record<string, string> }
export function selectProfile(host = 'cli', creatorVersion?: string, root = projectRoot) {
  const config = JSON.parse(fs.readFileSync(path.join(root, 'compatibility.json'), 'utf8')) as Compatibility;
  if (config.schemaVersion !== 1) throw new Error('Unsupported compatibility schema');
  if (host !== 'cli' && host !== 'creator') throw new Error('Unsupported host: ' + host);
  if (host === 'cli' && creatorVersion) throw new Error('CLI does not accept a Creator version');
  const id = host === 'cli' ? 'cli' : config.creatorVersions[creatorVersion || ''];
  if (!id || !Object.prototype.hasOwnProperty.call(config.profiles, id)) throw new Error('Creator version is not adapted: ' + creatorVersion);
  const profile = config.profiles[id];
  const layout = host === 'cli' ? 'cli-platform' : 'creator-extension';
  // Multiple versions share an adapter; validate entry points instead of hard-coding its name.
  const safeName = /^[a-z0-9][a-z0-9_-]*$/.test(profile.adapter);
  const required = host === 'creator' ? ['config.ts', 'hooks.ts', 'sharp.ts'] : ['config.ts', 'hooks.ts'];
  if (!safeName || profile.layout !== layout || profile.runtime !== 'systemjs'
    || !required.every(name => fs.existsSync(path.join(root, 'src/adapters', profile.adapter, name)))) {
    throw new Error('Adapter implementation is not available: ' + id);
  }
  return { id, ...profile };
}
