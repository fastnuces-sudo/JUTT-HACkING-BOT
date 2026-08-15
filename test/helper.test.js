import assert from 'node:assert/strict';
import test from 'node:test';
import { formatBytes, formatDuration, getPrefix, parseCommand } from '../lib/helper.js';

test('command parsing supports configured defaults and normalizes command names', () => {
  assert.equal(getPrefix('.menu'), '.');
  assert.deepEqual(parseCommand('!HeLp one two'), {
    prefix: '!',
    command: 'help',
    args: ['one', 'two'],
    text: 'one two',
  });
  assert.equal(parseCommand('plain text'), null);
  assert.equal(parseCommand('.   '), null);
});

test('formatters produce stable human-readable values', () => {
  assert.equal(formatDuration(1_000), '1s');
  assert.equal(formatDuration(3_661_000), '1h 1m 1s');
  assert.equal(formatBytes(0), '0 B');
  assert.equal(formatBytes(1024), '1.00 KB');
});

test('formatBytes stays correct past the gigabyte range and on bad input', () => {
  assert.equal(formatBytes(1024 ** 3), '1.00 GB');
  // Anything >= 1 TB used to overflow the unit table and render "undefined".
  assert.equal(formatBytes(1024 ** 4), '1.00 TB');
  assert.equal(formatBytes(5 * 1024 ** 5), '5.00 PB');
  // Clamped at the largest known unit rather than running off the end.
  assert.equal(formatBytes(1024 ** 7), '1048576.00 PB');
  assert.equal(formatBytes(-2048), '-2.00 KB');
  assert.equal(formatBytes(undefined), '0 B');
  assert.equal(formatBytes(NaN), '0 B');
});
