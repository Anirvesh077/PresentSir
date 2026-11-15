import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classesNeeded, tierFor, percent, bunksLeft, parseCsv } from '../src/logic.js';

test('tiers follow the 75 / 65 boundaries', () => {
  assert.equal(tierFor(75), 'safe');
  assert.equal(tierFor(74.9), 'warning');
  assert.equal(tierFor(65), 'warning');
  assert.equal(tierFor(64.9), 'critical');
  assert.equal(tierFor(percent(12, 16)), 'safe');
});

test('classesNeeded matches the worked example (10 of 16 needs 8)', () => {
  assert.equal(classesNeeded(10, 16), 8);
  assert.equal(classesNeeded(12, 16), 0);
  assert.equal(classesNeeded(0, 4), 12);
});

test('attending the computed number of classes really crosses 75%', () => {
  for (let total = 1; total <= 60; total++) {
    for (let attended = 0; attended <= total; attended++) {
      const x = classesNeeded(attended, total);
      assert.ok((attended + x) / (total + x) >= 0.75 - 1e-12, `${attended}/${total}`);
      if (x > 0) assert.ok((attended + x - 1) / (total + x - 1) < 0.75, `${attended}/${total} not minimal`);
    }
  }
});

test('bunksLeft', () => {
  assert.equal(bunksLeft(16, 16), 5); // 16/21 = 76%
  assert.equal(bunksLeft(12, 16), 0);
});

test('csv parser copes with quotes and CRLF', () => {
  const rows = parseCsv('a,b\r\n"x, y",2\r\n');
  assert.deepEqual(rows, [['a', 'b'], ['x, y', '2']]);
});
