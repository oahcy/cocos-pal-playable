// Resolve from the editor, never from this plugin's node_modules.
declare const Editor: { App: { path: string } };
if (typeof Editor === 'undefined' || !Editor.App?.path) {
  throw new Error('Creator image compression requires Editor.App.path');
}
const hostSharp = require(Editor.App.path + '/node_modules/sharp') as typeof import('sharp');
export default hostSharp;
