import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { aliases, categories, conflicts, loadAllPlugins, plugins } from '../lib/pluginLoader.js';

test('every plugin file loads with all runtime dependencies available', async () => {
  const root = path.resolve(import.meta.dirname, '../plugins');
  const categoryNames = await fs.readdir(root);
  const fileLists = await Promise.all(categoryNames.map(name => fs.readdir(path.join(root, name))));
  const expectedFiles = fileLists.flat().filter(name => name.endsWith('.js')).length;
  const loadedFiles = await loadAllPlugins();
  assert.ok(expectedFiles >= 251);
  assert.equal(loadedFiles, expectedFiles);
  assert.deepEqual(conflicts, []);
  assert.ok(plugins.size >= 300, `expected at least 300 commands, got ${plugins.size}`);
  assert.ok(aliases.size >= 700, `expected at least 700 aliases, got ${aliases.size}`);
  assert.equal(categories.size, 11);
  assert.ok(plugins.has('menu'));
  assert.ok(plugins.has('ping'));
  assert.ok(aliases.has('help'));
});
