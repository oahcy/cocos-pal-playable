export function showStartupError(document: Document, error: unknown): void {
  console.error('[Playable] Startup failed', error);
  if (document.getElementById('playable-startup-error')) return;
  const message = document.createElement('div');
  message.id = 'playable-startup-error';
  message.setAttribute('role', 'alert');
  message.textContent = 'Unable to start this playable. Please reload and try again.';
  message.style.cssText = 'position:fixed;inset:0;display:grid;place-items:center;padding:24px;background:#171717;color:white;font:16px sans-serif;z-index:9999';
  document.body.appendChild(message);
}
