import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { backupDatabase, extractDbName, getMongoUri } from '../lib/database.js';

test('database credentials only come from MONGODB_URI', () => {
  assert.equal(getMongoUri({}), null);
  assert.equal(getMongoUri({ MONGODB_URI: 'mongodb://user:PASSWORD@localhost/db' }), null);
  assert.equal(
    getMongoUri({ MONGODB_URI: '  mongodb://user:secret@localhost/jutts_bot  ' }),
    'mongodb://user:secret@localhost/jutts_bot',
  );
  assert.throws(() => getMongoUri({ MONGODB_URI: 'https://example.com' }), /must start with/);
});

test('database name is read from URI with safe fallbacks', () => {
  assert.equal(extractDbName('mongodb://localhost:27017/my_db?authSource=admin', {}), 'my_db');
  assert.equal(extractDbName('mongodb+srv://host.example/?retryWrites=true', {}), 'jutts_bot');
  assert.equal(extractDbName('mongodb://localhost/ignored', { MONGODB_DB: 'explicit_db' }), 'explicit_db');
  assert.equal(extractDbName('mongodb://localhost/name%20with%20spaces', {}), 'name with spaces');
});

test('local backup writes a private JSON snapshot', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'jutts-backup-'));
  try {
    const filename = backupDatabase(directory);
    const backup = JSON.parse(fs.readFileSync(filename, 'utf8'));
    assert.ok(backup.createdAt);
    assert.ok(backup.collections.settings);
    assert.equal(fs.statSync(filename).mode & 0o777, 0o600);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
