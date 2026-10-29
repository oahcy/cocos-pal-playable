import type { normalizeOptions } from '../options';
export interface ApplicationAdapter {
  prepareSettings(config: Record<string, unknown>, selected: ReturnType<typeof normalizeOptions>): void;
  prepareApplication(source: string): string;
}
