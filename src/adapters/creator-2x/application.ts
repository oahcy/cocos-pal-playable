import type { ApplicationAdapter } from '../application';
export const applicationAdapter: ApplicationAdapter = {
  prepareSettings() { throw new Error('Creator 2 uses its dedicated build adapter'); },
  prepareApplication() { throw new Error('Creator 2 uses its dedicated Web bootstrap'); },
};
