import * as zh from '../../i18n/zh';

export interface TaskOptions {
  platform: string;
  packages: Record<string, unknown> & { playable: { channels?: Record<string, Record<string, unknown>> } };
}
interface PanelInstance {
  $: Record<string, HTMLElement>;
  dispatch(name: string, path: string, value: unknown, error: string | null): void;
}
interface PanelModule {
  $: Record<string, string>; template: string; style: string;
  ready(this: PanelInstance, options: TaskOptions, type: string): void;
  update(this: PanelInstance, options: TaskOptions): void;
  close(this: PanelInstance): void;
}
interface UpdateEvent { name: string; path: string; value: unknown; error: string | null }
export interface PanelTestHost {
  events: UpdateEvent[];
  snapshot(): TaskOptions;
  error(): string | null;
  collectTask(): TaskOptions;
  externalUpdate(options: TaskOptions): void;
  close(): void;
}
declare global { interface Window { panelTest: PanelTestHost } }

const host = window as unknown as {
  module: { exports: PanelModule };
  Editor: { I18n: { t(key: string): string } };
  panelTest: PanelTestHost;
};

// Only Editor's translation and configuration transport are mocked; the form is real plugin code.
host.Editor = { I18n: { t(key) {
  const name = key.replace(/^playable\.options\./, '');
  return (zh.options as Record<string, string>)[name] ?? key;
} } };
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));
const storageKey = 'playable-panel-test-task';
let task: TaskOptions = JSON.parse(localStorage.getItem(storageKey) || 'null') ?? {
  platform: 'playable', packages: { playable: {}, unrelated: { untouched: true } },
};
let error: string | null = null;
const events: UpdateEvent[] = [];
const panel = host.module.exports;
const container = document.getElementById('panel')!.attachShadow({ mode: 'open' });
container.innerHTML = '<style>' + panel.style + '</style>' + panel.template;
const instance: PanelInstance = {
  $: Object.fromEntries(Object.entries(panel.$).map(([name, selector]) => [name, container.querySelector<HTMLElement>(selector)!])),
  dispatch(name, path, value, validationError) {
    events.push(clone({ name, path, value, error: validationError }));
    if (name !== 'update' || path !== 'packages.playable.channels') throw new Error('Unexpected configuration event');
    // Persist the event payload independently. Do not copy the plugin's mutated options.
    task.packages.playable.channels = clone(value) as TaskOptions['packages']['playable']['channels'];
    error = validationError;
    localStorage.setItem(storageKey, JSON.stringify(task));
  },
};
panel.ready.call(instance, clone(task), new URL(location.href).searchParams.get('mode') === 'check' ? 'check' : 'build');
host.panelTest = {
  events,
  snapshot: () => clone(task),
  error: () => error,
  collectTask() {
    if (error) throw new Error(error);
    return clone(task);
  },
  externalUpdate(options) { task = clone(options); panel.update.call(instance, clone(task)); },
  close() { panel.close.call(instance); },
};
