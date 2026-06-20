import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { logger } from './logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pluginsDir = path.join(__dirname, '../plugins');

export const plugins = new Map();
export const aliases = new Map();
export const categories = new Map();

export async function loadPlugin(filePath) {
  try {
    const url = pathToFileURL(filePath).href + `?t=${Date.now()}`;
    const mod = await import(url);
    const plugin = mod.default || mod;

    if (!plugin || !plugin.command) return null;

    const cmds = Array.isArray(plugin.command) ? plugin.command : [plugin.command];

    cmds.forEach(cmd => {
      plugins.set(cmd.toLowerCase(), plugin);
    });

    if (plugin.alias) {
      const aliasArr = Array.isArray(plugin.alias) ? plugin.alias : [plugin.alias];
      aliasArr.forEach(a => aliases.set(a.toLowerCase(), cmds[0].toLowerCase()));
    }

    const cat = plugin.category || 'misc';
    if (!categories.has(cat)) categories.set(cat, []);
    const catArr = categories.get(cat);
    if (!catArr.includes(cmds[0])) catArr.push(cmds[0]);

    return plugin;
  } catch (err) {
    logger.error({ err, filePath }, 'Failed to load plugin');
    return null;
  }
}

export async function loadAllPlugins() {
  plugins.clear();
  aliases.clear();
  categories.clear();

  const categoryDirs = await fs.readdir(pluginsDir).catch(() => []);
  let loaded = 0;

  for (const dir of categoryDirs) {
    const dirPath = path.join(pluginsDir, dir);
    const stat = await fs.stat(dirPath).catch(() => null);
    if (!stat?.isDirectory()) continue;

    const files = await fs.readdir(dirPath).catch(() => []);
    for (const file of files) {
      if (!file.endsWith('.js')) continue;
      const filePath = path.join(dirPath, file);
      const result = await loadPlugin(filePath);
      if (result) loaded++;
    }
  }

  logger.info({ count: loaded }, '🔌 Plugins loaded');
  return loaded;
}

export function getPlugin(name) {
  const cmd = name.toLowerCase();
  if (plugins.has(cmd)) return plugins.get(cmd);
  if (aliases.has(cmd)) return plugins.get(aliases.get(cmd));
  return null;
}

export function getAllPlugins() {
  return Array.from(plugins.values());
}

export function getPluginsByCategory(cat) {
  const cmds = categories.get(cat) || [];
  return cmds.map(c => plugins.get(c)).filter(Boolean);
}

export function getCategories() {
  const result = {};
  for (const [cat, cmds] of categories) {
    result[cat] = cmds;
  }
  return result;
}

export async function reloadPlugins() {
  const count = await loadAllPlugins();
  return count;
}

export default { loadAllPlugins, loadPlugin, getPlugin, getAllPlugins, getCategories, plugins, aliases, categories };
