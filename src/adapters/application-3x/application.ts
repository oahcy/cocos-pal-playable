import type { ApplicationAdapter } from '../application';
import { applicationAdapter as applicationClass } from '../application-class/application';
import { applicationAdapter as applicationFactory } from '../creator-300_352/application';
export const applicationAdapter: ApplicationAdapter = {
  prepareSettings(config, selected) {
    if (config.assets && typeof config.assets === 'object') applicationClass.prepareSettings(config, selected);
    else applicationFactory.prepareSettings(config, selected);
  },
  prepareApplication(source) {
    if (/\bApplication\b/.test(source) && !/\bcreateApplication\b/.test(source)) return source;
    return applicationFactory.prepareApplication(source);
  },
};
