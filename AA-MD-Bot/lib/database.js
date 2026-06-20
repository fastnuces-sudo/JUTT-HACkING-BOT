import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbDir = path.join(__dirname, '../database');
fs.ensureDirSync(dbDir);

const dbFiles = {
  users: path.join(dbDir, 'users.json'),
  groups: path.join(dbDir, 'groups.json'),
  settings: path.join(dbDir, 'settings.json'),
  sessions: path.join(dbDir, 'sessions.json'),
};

const cache = {};

function loadDb(name) {
  if (!cache[name]) {
    try { cache[name] = fs.readJsonSync(dbFiles[name]); }
    catch { cache[name] = {}; }
  }
  return cache[name];
}

function saveDb(name) {
  fs.writeJsonSync(dbFiles[name], cache[name], { spaces: 2 });
}

export const db = {
  users: {
    get: (id) => {
      const u = loadDb('users');
      if (!u[id]) {
        u[id] = { id, name: '', xp: 0, level: 1, balance: 1000, commandsUsed: 0,
          lastDaily: null, dailyStreak: 0, warnings: 0, banned: false,
          createdAt: Date.now(), inventory: [], lastSeen: Date.now() };
        saveDb('users');
      }
      return u[id];
    },
    set: (id, data) => { const u = loadDb('users'); u[id] = { ...u[id], ...data }; saveDb('users'); return u[id]; },
    all: () => loadDb('users'),
    delete: (id) => { const u = loadDb('users'); delete u[id]; saveDb('users'); },
    addXP: (id, amount) => {
      const u = loadDb('users');
      if (!u[id]) db.users.get(id);
      u[id].xp = (u[id].xp || 0) + amount;
      const newLevel = Math.floor(0.1 * Math.sqrt(u[id].xp)) + 1;
      const leveled = newLevel > (u[id].level || 1);
      u[id].level = newLevel;
      saveDb('users');
      return { xp: u[id].xp, level: u[id].level, leveled };
    },
    addBalance: (id, amount) => {
      const u = loadDb('users');
      if (!u[id]) db.users.get(id);
      u[id].balance = (u[id].balance || 0) + amount;
      saveDb('users');
      return u[id].balance;
    },
    deductBalance: (id, amount) => {
      const u = loadDb('users');
      if (!u[id]) db.users.get(id);
      if ((u[id].balance || 0) < amount) return false;
      u[id].balance -= amount;
      saveDb('users');
      return u[id].balance;
    },
  },
  groups: {
    get: (id) => {
      const g = loadDb('groups');
      if (!g[id]) {
        g[id] = { id, name: '', antilink: false, antibot: false, welcome: false,
          welcomeMsg: 'Welcome @user!', goodbye: false, goodbyeMsg: 'Goodbye @user!',
          muted: false, warnings: {}, createdAt: Date.now() };
        saveDb('groups');
      }
      return g[id];
    },
    set: (id, data) => { const g = loadDb('groups'); g[id] = { ...g[id], ...data }; saveDb('groups'); return g[id]; },
    all: () => loadDb('groups'),
    delete: (id) => { const g = loadDb('groups'); delete g[id]; saveDb('groups'); },
  },
  settings: {
    get: () => loadDb('settings'),
    set: (data) => { const s = loadDb('settings'); Object.assign(s, data); saveDb('settings'); return s; },
    getValue: (key) => loadDb('settings')[key],
    setValue: (key, value) => { const s = loadDb('settings'); s[key] = value; saveDb('settings'); },
  },
  sessions: {
    get: () => loadDb('sessions'),
    set: (id, data) => { const s = loadDb('sessions'); s[id] = { ...s[id], ...data }; saveDb('sessions'); },
    delete: (id) => { const s = loadDb('sessions'); delete s[id]; saveDb('sessions'); },
    all: () => loadDb('sessions'),
  },
  reload: () => { Object.keys(cache).forEach(k => delete cache[k]); },
  backup: () => {
    const dir = path.join(dbDir, '../logs/backups');
    fs.ensureDirSync(dir);
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    Object.keys(dbFiles).forEach(n => fs.copySync(dbFiles[n], path.join(dir, `${n}-${ts}.json`)));
    return dir;
  },
};

export default db;
