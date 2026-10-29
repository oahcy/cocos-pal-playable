import { channelIds } from '../../channel';
declare const Editor: { Profile: { load(path: string): { getSelfData(): Record<string, unknown>; set(key: string, value: unknown): void; save(): void } } };
const profile = typeof Editor === 'undefined' ? undefined : Editor.Profile.load('project://playable.json');
const saved = profile?.getSelfData() || {};
const channels = (saved.channels || Object.fromEntries(channelIds.map(id => [id, { enabled: id === 'tiktok', outputFormat: 'channel-default', embeddedEncoding: 'base64', orientation: 'auto', imageCompression: 'none', imageQuality: 80, storeUrl: '' }]))) as Record<string, unknown>;
export const name = 'playable';
export const template = `<div>
  <section v-for="(channel, id) in channels">
    <ui-prop v-bind:name="id"><ui-checkbox v-value="channel.enabled"></ui-checkbox></ui-prop>
    <div v-if="channel.enabled">
      <ui-prop name="输出格式"><ui-select v-value="channel.outputFormat"><option value="channel-default">渠道默认</option><option value="directory-zip">ZIP</option><option value="single-html">单 HTML</option></ui-select></ui-prop>
      <ui-prop name="内嵌编码"><ui-select v-value="channel.embeddedEncoding"><option value="base64">Base64</option><option value="base122">Base122</option></ui-select></ui-prop>
      <ui-prop name="方向"><ui-select v-value="channel.orientation"><option value="auto">自适应</option><option value="portrait">竖屏</option><option value="landscape">横屏</option></ui-select></ui-prop>
      <ui-prop name="PNG 压缩"><ui-select v-value="channel.imageCompression"><option value="none">不压缩</option><option value="lossy">有损</option></ui-select></ui-prop>
      <ui-prop name="质量 (1-100)"><ui-num-input v-value="channel.imageQuality" min="1" max="100" step="1"></ui-num-input></ui-prop>
      <ui-prop name="商店 HTTPS URL" v-if="id === 'applovin'"><ui-input v-value="channel.storeUrl"></ui-input></ui-prop>
    </div>
  </section>
</div>`;
export const data = () => ({ channels });
export const watch = { channels: { deep: true, handler(value: unknown) { profile?.set('channels', value); profile?.save(); } } };
