import assert from 'node:assert/strict';
import test from 'node:test';
import config from '../config.js';

test('default config does not ship a universal privileged phone number', () => {
  if (!process.env.SUPER_OWNER) assert.equal(config.superOwner, '');
  if (!process.env.OWNER_NUMBERS && !process.env.SUPER_OWNER) {
    assert.deepEqual(config.owners, []);
    assert.deepEqual(config.ownerNumber, []);
  }
});
