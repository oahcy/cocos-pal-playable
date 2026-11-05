import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EngineLogCheck } from '../scripts/preview/verify-logs';

test('engine banner identifies exact runtime version including styled and repeated logs', () => {
  const logs = new EngineLogCheck('2.4.12');
  logs.observe('unrelated output');
  logs.observe('%cCocos Creator v2.4.12 %ccolor: green');
  logs.observe('Cocos Creator v2.4.12');
  assert.equal(logs.verify(), '2.4.12');
  const modern = new EngineLogCheck();
  modern.observe('Cocos Creator v3.8.8');
  assert.equal(modern.verify(), '3.8.8');
});

test('missing, conflicting and mismatched engine logs fail acceptance', () => {
  const logs = new EngineLogCheck('2.4.12');
  logs.observe('Cocos Creator v2.4.1');
  assert.throws(() => logs.verify(), /expected 2.4.12, got 2.4.1/);
  logs.observe('Cocos Creator v2.4.12');
  assert.throws(() => logs.verify(), /Conflicting/);
  assert.throws(() => new EngineLogCheck().verify(), /Missing engine version evidence/);
  assert.throws(() => new EngineLogCheck('').verify(), /full Creator version/);
});

test('release engines may prove version through runtime and cannot contradict banner', () => {
  const release = new EngineLogCheck('3.5.2');
  assert.equal(release.hasBanner, false);
  assert.equal(release.verify('3.5.2'), '3.5.2');
  const conflicting = new EngineLogCheck('3.7.3');
  conflicting.observe('Cocos Creator v3.7.3');
  assert.throws(() => conflicting.verify('3.5.2'), /Conflicting/);
  assert.throws(() => new EngineLogCheck('3.5.2').verify('3.7.3'), /mismatch/);
  assert.throws(() => new EngineLogCheck().verify('invalid'), /Invalid runtime/);
});
