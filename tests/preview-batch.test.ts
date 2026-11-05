import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { readVerifyCases } from '../scripts/preview/batch';

test('batch config resolves artifacts relative to config and requires an independent expected version', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'playable-batch-'));
  const file = path.join(directory, 'cases.json');
  try {
    fs.writeFileSync(file, JSON.stringify([{ archive: 'a.zip', expectedVersion: '2.4.12' }, { archive: 'b.html', expectedVersion: '3.7.3' }]));
    assert.deepEqual(readVerifyCases(file), [
      { archive: path.join(directory, 'a.zip'), expectedVersion: '2.4.12' },
      { archive: path.join(directory, 'b.html'), expectedVersion: '3.7.3' },
    ]);
    for (const invalid of [[], {}, [null], [{ archive: 'a.zip' }], [{ archive: '', expectedVersion: '2.4.12' }], [{ archive: 'a.zip', expectedVersion: '' }]]) {
      fs.writeFileSync(file, JSON.stringify(invalid));
      assert.throws(() => readVerifyCases(file));
    }
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});
