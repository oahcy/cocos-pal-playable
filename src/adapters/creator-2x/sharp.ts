// Creator 2 has no Editor.App on some hosts. Resolve only from the installed editor.
import path from 'node:path';
declare const Editor: { App?: { path?: string }; url?(value: string): string };
const root = typeof Editor === 'undefined' ? undefined : Editor.App?.path || Editor.url?.('app://');
if (!root) throw new Error('Creator image compression requires the editor installation path');
const hostSharp = require(path.join(root, 'node_modules/sharp')) as typeof import('sharp');
export default hostSharp;
