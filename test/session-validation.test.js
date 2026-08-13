import assert from 'node:assert/strict';
import test from 'node:test';
import { createSession, deleteSession } from '../lib/sessionManager.js';

test('session manager rejects unsafe IDs before touching auth storage', async () => {
  await assert.rejects(createSession('../escape'), /Invalid session ID/);
  await assert.rejects(createSession('contains spaces'), /Invalid session ID/);
  await assert.rejects(deleteSession('../../escape'), /Invalid session ID/);
});

test('pairing requires a plausible international phone number', async () => {
  await assert.rejects(createSession('safe_id', true, '123'), /Invalid pairing phone number/);
});
