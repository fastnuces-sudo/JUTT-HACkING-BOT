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
