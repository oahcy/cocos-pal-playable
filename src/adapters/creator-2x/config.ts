import { buildStart, buildFinished } from './hooks';
declare const Editor: { Builder: { DefaultButtons: { Build: unknown } }; url(path: string): string };
// Creator 2 registers a simple-build-target, not a 3.x builder contribution.
module.exports = {
  name: 'Playable', platform: 'playable', extends: 'web-mobile',
  buttons: typeof Editor === 'undefined' ? [] : [Editor.Builder.DefaultButtons.Build],
  buildStart,
  md5: { globalIgnore: () => [/.*/] },
  messages: { 'build-finished': buildFinished },
  settings: typeof Editor === 'undefined' ? '' : Editor.url('packages://playable/dist/panel.cjs'),
};
