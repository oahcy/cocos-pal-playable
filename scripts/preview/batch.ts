import fs from 'node:fs';
import path from 'node:path';
import { EngineLogCheck } from './verify-logs';

export interface VerifyCase { archive: string; expectedVersion: string }

export function readVerifyCases(file: string): VerifyCase[] {
  const config = JSON.parse(fs.readFileSync(file, 'utf8')) as unknown;
  if (!Array.isArray(config) || config.length === 0) throw new Error('Batch config must be a non-empty array');
  return config.map((item: unknown, index) => {
    if (!item || typeof item !== 'object') throw new Error('Invalid batch case ' + (index + 1));
    const { archive, expectedVersion } = item as Partial<VerifyCase>;
    if (typeof archive !== 'string' || !archive.trim() || typeof expectedVersion !== 'string') {
      throw new Error('Batch case ' + (index + 1) + ' requires archive and expectedVersion');
    }
    new EngineLogCheck(expectedVersion);
    return { archive: path.resolve(path.dirname(file), archive), expectedVersion };
  });
}
