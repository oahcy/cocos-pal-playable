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
  // Only executable adapters are enabled. A mapping alone never claims compatibility.
  const available = host === 'cli' ? profile.adapter === 'cli' && profile.layout === 'cli-platform'
    : profile.adapter === 'creator-383' && profile.layout === 'creator-extension';
  if (!available || profile.runtime !== 'systemjs') {
    throw new Error('Adapter implementation is not available: ' + id);
  }
  return { id, ...profile };
}
