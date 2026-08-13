import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const root = path.resolve(import.meta.dirname, '..');
const excluded = new Set(['.git', 'node_modules', 'logs', 'temp', 'session', 'downloads', 'cache']);
const extensions = new Set(['.js', '.mjs', '.cjs']);
const files = [];

async function walk(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    if (excluded.has(entry.name)) continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) await walk(absolute);
    else if (extensions.has(path.extname(entry.name))) files.push(absolute);
  }
}

await walk(root);
files.sort();

const failures = [];
let nextIndex = 0;
async function worker() {
  while (nextIndex < files.length) {
    const file = files[nextIndex++];
    try {
      await execFileAsync(process.execPath, ['--check', file], { timeout: 20_000 });
    } catch (error) {
      failures.push({ file: path.relative(root, file), output: error.stderr || error.message });
    }
  }
}

const concurrency = Math.min(8, Math.max(2, os.availableParallelism?.() || os.cpus().length), files.length);
await Promise.all(Array.from({ length: concurrency }, () => worker()));

if (failures.length) {
  for (const failure of failures) console.error(`\n${failure.file}\n${failure.output}`);
  console.error(`\n${failures.length} file(s) failed syntax validation.`);
  process.exit(1);
}

console.log(`Syntax OK: ${files.length} JavaScript files`);
