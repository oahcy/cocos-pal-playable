// Creator 2 ships its image backend under resources/utils, outside app.asar.
// Resolve relative to app.asar on Windows and macOS; 2.x has no utils:// protocol.
import fs from 'node:fs';
import path from 'node:path';
declare const Editor: { url?(value: string): string; App?: { path?: string } };
if (typeof Editor === 'undefined') throw new Error('Creator 2 image compression requires the editor host');
const appPath = Editor.App?.path || Editor.url?.('app://');
const hostPath = appPath ? path.resolve(appPath, '../utils/sharp') : undefined;
if (!hostPath || !fs.existsSync(path.join(hostPath, 'package.json'))) {
  throw new Error('Creator 2 host Sharp was not found in resources/utils/sharp; disable image compression or verify this Creator installation');
}
// Dependencies are resolved by the initialized Editor host; never modify global module paths.
const sharp = require(hostPath) as typeof import('sharp');
console.log('[Playable] Image backend: Creator utils/sharp (Node ' + process.versions.node + ').');
export default sharp;
