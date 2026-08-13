import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { logger } from './logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pluginsDir = path.join(__dirname, '../plugins');

export const plugins = new Map();
export const aliases = new Map();
export const categories = new Map();
export const conflicts = [];

function registerPlugin(plugin, source = 'unknown') {
  if (!plugin?.command) return false;
  const cmds = (Array.isArray(plugin.command) ? plugin.command : [plugin.command])
    .map(command => String(command).toLowerCase());
  let registered = false;

  for (const command of cmds) {
    if (plugins.has(command)) {
      conflicts.push({ type: 'command', name: command, source });
      continue;
    }
    // A real command always takes precedence over an older alias with that name.
    if (aliases.has(command)) {
      conflicts.push({ type: 'command-alias', name: command, source });
      aliases.delete(command);
    }
    plugins.set(command, plugin);
    registered = true;
  }

  if (plugin.alias && registered) {
    const pluginAliases = Array.isArray(plugin.alias) ? plugin.alias : [plugin.alias];
    for (const value of pluginAliases) {
      const alias = String(value).toLowerCase();
      if (plugins.has(alias) || aliases.has(alias)) {
        conflicts.push({ type: 'alias', name: alias, source });
        continue;
      }
      aliases.set(alias, cmds[0]);
    }
  }

  if (!registered) return false;
  const category = plugin.category || 'misc';
  if (!categories.has(category)) categories.set(category, []);
  const categoryCommands = categories.get(category);
  if (!categoryCommands.includes(cmds[0])) categoryCommands.push(cmds[0]);
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
        if (registerPlugin(plugin, path.basename(filePath))) count++;
      }
      return count > 0 ? exported[0] : null;
    }

    // Single plugin object
    return registerPlugin(exported, path.basename(filePath)) ? exported : null;
  } catch (err) {
    logger.warn({ err: err.message, filePath: path.basename(filePath) }, 'Plugin load failed');
    return null;
  }
}

export async function loadAllPlugins() {
  plugins.clear(); aliases.clear(); categories.clear(); conflicts.length = 0;
  const dirs = (await fs.readdir(pluginsDir).catch(() => [])).sort();
  let loaded = 0;
  for (const dir of dirs) {
    const dirPath = path.join(pluginsDir, dir);
    const stat = await fs.stat(dirPath).catch(() => null);
    if (!stat?.isDirectory()) continue;
    const files = (await fs.readdir(dirPath).catch(() => [])).sort();
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
