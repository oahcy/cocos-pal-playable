import JSON5 from 'json5';
export interface Creator2Settings extends Record<string, unknown> {
  server?: string;
  remoteBundles?: string[];
}
/** Creator 2 release builds emit unquoted keys. Parse data, never execute the script. */
export function readCreator2Settings(source: string): Creator2Settings {
  const match = /^\s*window\._CCSettings\s*=\s*([\s\S]*?)\s*;?\s*$/.exec(source);
  if (!match) throw new Error('Unsupported Creator 2 settings script');
  const settings: unknown = JSON5.parse(match[1]);
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) throw new Error('Creator 2 settings must be a data object');
  return settings as Creator2Settings;
}
