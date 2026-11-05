import { createPlayable } from '../../runtime/core';
import type { ChannelAdapter } from '../../runtime/adapter';

/** SDK-only page. The same API core and channel adapters are used by game builds. */
export function startDemo(createAdapter: () => ChannelAdapter): void {
  const output = document.getElementById('events')!;
  const errorOutput = document.getElementById('error')!;
  const lines: string[] = [];
  const unsubscribe: PlayableUnsubscribe[] = [];
  let muted: boolean | undefined;
  function log(message: string) {
    lines.push(new Date().toLocaleTimeString() + ' ' + message);
    if (lines.length > 100) lines.shift();
    output.textContent = lines.join('\n');
    output.scrollTop = output.scrollHeight;
  }
  function reportError(error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    errorOutput.textContent = message;
    errorOutput.hidden = false;
    log('ERROR ' + message);
    console.error('[SDK demo]', error);
  }

  window.addEventListener('error', event => reportError(event.error || event.message));
  window.addEventListener('unhandledrejection', event => reportError(event.reason));
  log('初始化统一 API');
  try {
    const adapter = window.__playablePreview ? window.__playablePreview.createAdapter() : createAdapter();
    const api = createPlayable(adapter, document, reportError);
    window.playable = api;

    function render() {
      document.getElementById('channel')!.textContent = api.channel;
      document.getElementById('ready')!.textContent = String(api.ready);
      document.getElementById('viewable')!.textContent = String(api.viewable);
      document.getElementById('muted')!.textContent = muted === undefined ? '等待回调' : String(muted);
      document.getElementById('capabilities')!.textContent = JSON.stringify(api.capabilities, null, 2);
      document.getElementById('listening')!.textContent = unsubscribe.length ? '已订阅' : '已取消';
    }
    function stopListening() {
      for (const off of unsubscribe) off();
      unsubscribe.length = 0;
    }
    function listen() {
      stopListening();
      unsubscribe.push(api.onReady(() => { log('onReady'); render(); }));
      unsubscribe.push(api.onPause(() => { log('onPause'); render(); }));
      unsubscribe.push(api.onResume(() => { log('onResume'); render(); }));
      unsubscribe.push(api.onMuteChange(value => {
        muted = value;
        log('onMuteChange ' + value);
        render();
      }));
      log('已订阅 onReady / onPause / onResume / onMuteChange');
      render();
    }
    function action(id: string, name: string, callback: () => void) {
      const button = document.getElementById(id) as HTMLButtonElement;
      button.disabled = false;
      button.addEventListener('click', () => {
        log('调用 ' + name);
        try { callback(); }
        catch (error) { reportError(error); }
      });
    }

    action('download', 'openStore()', () => {
      api.openStore();
      log('openStore() 已返回');
    });
    action('finish', 'finish()', () => {
      api.finish();
      log(api.capabilities.finishNotification ? 'finish() 已返回' : 'finish() 已记录本地结束');
    });
    action('read', '读取状态', () => { render(); log('状态已刷新'); });
    action('unsubscribe', '取消监听', () => {
      stopListening();
      render();
      log('四项监听的退订函数已执行');
    });
    action('subscribe', '重新监听', listen);
    listen();
    render();
  } catch (error) { reportError(error); }
}
