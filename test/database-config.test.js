import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { backupDatabase, buildPoolConfig, extractDbName, getDatabaseUrl } from '../lib/database.js';

test('database credentials only come from DATABASE_URL', () => {
  assert.equal(getDatabaseUrl({}), null);
  assert.equal(
    getDatabaseUrl({ DATABASE_URL: 'postgresql://user:PASSWORD@ep-x.neon.tech/db' }),
    null,
  );
  assert.equal(
    getDatabaseUrl({ DATABASE_URL: '  postgresql://user:secret@ep-x.neon.tech/jutts_bot?sslmode=require  ' }),
    'postgresql://user:secret@ep-x.neon.tech/jutts_bot?sslmode=require',
  );
  assert.equal(getDatabaseUrl({ DATABASE_URL: 'postgres://u:p@localhost/db' }), 'postgres://u:p@localhost/db');
  assert.throws(() => getDatabaseUrl({ DATABASE_URL: 'https://example.com' }), /must start with/);
  assert.throws(() => getDatabaseUrl({ DATABASE_URL: 'mongodb://user:secret@localhost/db' }), /must start with/);
});

test('NEON_DATABASE_URL is accepted as an alias', () => {
  assert.equal(
    getDatabaseUrl({ NEON_DATABASE_URL: 'postgresql://u:s@ep-x.neon.tech/jutts_bot' }),
    'postgresql://u:s@ep-x.neon.tech/jutts_bot',
  );
  // DATABASE_URL wins when both are present.
  assert.equal(
    getDatabaseUrl({
      DATABASE_URL: 'postgresql://a:b@ep-1.neon.tech/one',
      NEON_DATABASE_URL: 'postgresql://c:d@ep-2.neon.tech/two',
    }),
    'postgresql://a:b@ep-1.neon.tech/one',
  );
});

test('database name is read from URL with safe fallbacks', () => {
  assert.equal(extractDbName('postgresql://localhost:5432/my_db?sslmode=require', {}), 'my_db');
  assert.equal(extractDbName('postgresql://ep-x.neon.tech/?sslmode=require', {}), 'jutts_bot');
  assert.equal(extractDbName('postgres://localhost/ignored', { PGDATABASE: 'explicit_db' }), 'explicit_db');
  assert.equal(extractDbName('postgres://localhost/name%20with%20spaces', {}), 'name with spaces');
});

test('TLS is required for Neon but not for loopback Postgres', () => {
  const neon = buildPoolConfig('postgresql://u:p@ep-x-pooler.aws.neon.tech/jutts_bot?sslmode=require', {});
  assert.deepEqual(neon.ssl, { rejectUnauthorized: true });

  const local = buildPoolConfig('postgresql://u:p@127.0.0.1:5432/jutts_bot', {});
  assert.equal(local.ssl, undefined);

  const localhost = buildPoolConfig('postgresql://u:p@localhost:5432/jutts_bot', {});
  assert.equal(localhost.ssl, undefined);

  const disabled = buildPoolConfig('postgresql://u:p@db.example.com/jutts_bot?sslmode=disable', {});
  assert.equal(disabled.ssl, undefined);
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
