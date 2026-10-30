// Creator 2 does not consistently ship Sharp. Use the plugin's N-API 3 build,
// which runs in the editor process without an external Node installation.
import path from 'node:path';
const sharp = require(path.join(__dirname, '../node_modules/sharp-creator2')) as typeof import('sharp');
console.log('[Playable] Image backend: bundled Sharp (Editor Node ' + process.versions.node + ', PID ' + process.pid + ').');
export default sharp;
