import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { logger } from './logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pluginsDir = path.join(__dirname, '../plugins');

export const plugins = new Map();
export const aliases = new Map();
export const categories = new Map();

function registerPlugin(plugin) {
  if (!plugin?.command) return false;
  const cmds = Array.isArray(plugin.command) ? plugin.command : [plugin.command];
  cmds.forEach(cmd => plugins.set(cmd.toLowerCase(), plugin));
  if (plugin.alias) {
    const arr = Array.isArray(plugin.alias) ? plugin.alias : [plugin.alias];
    arr.forEach(a => aliases.set(a.toLowerCase(), cmds[0].toLowerCase()));
  }
  const cat = plugin.category || 'misc';
  if (!categories.has(cat)) categories.set(cat, []);
  const catArr = categories.get(cat);
  if (!catArr.includes(cmds[0])) catArr.push(cmds[0]);
  return true;
}

export async function loadPlugin(filePath) {
  try {
    const url = pathToFileURL(filePath).href + `?t=${Date.now()}`;
    const mod = await import(url);
    const exported = mod.default || mod;

    // Support array of plugins (e.g. Islamic plugin exports an array)
    if (Array.isArray(exported)) {
      let count = 0;
      for (const plugin of exported) {
        if (registerPlugin(plugin)) count++;
      }
      return count > 0 ? exported[0] : null;
    }

    // Single plugin object
    return registerPlugin(exported) ? exported : null;
  } catch (err) {
    logger.warn({ err: err.message, filePath: path.basename(filePath) }, 'Plugin load failed');
    return null;
  }
}

export async function loadAllPlugins() {
  plugins.clear(); aliases.clear(); categories.clear();
  const dirs = await fs.readdir(pluginsDir).catch(() => []);
  let loaded = 0;
  for (const dir of dirs) {
    const dirPath = path.join(pluginsDir, dir);
    const stat = await fs.stat(dirPath).catch(() => null);
    if (!stat?.isDirectory()) continue;
    const files = await fs.readdir(dirPath).catch(() => []);
    for (const file of files) {
      if (!file.endsWith('.js')) continue;
      const result = await loadPlugin(path.join(dirPath, file));
      if (result) loaded++;
    }
  }
  return loaded;
}

export function getPlugin(name) {
  const cmd = name.toLowerCase();
  if (plugins.has(cmd)) return plugins.get(cmd);
  if (aliases.has(cmd)) return plugins.get(aliases.get(cmd));
  return null;
}

export function getCategories() {
  const result = {};
  for (const [cat, cmds] of categories) result[cat] = cmds;
  return result;
}

export async function reloadPlugins() { return loadAllPlugins(); }

export default { loadAllPlugins, loadPlugin, getPlugin, getCategories, reloadPlugins, plugins, aliases, categories };
