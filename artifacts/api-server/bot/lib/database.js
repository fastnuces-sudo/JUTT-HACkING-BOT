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
    try {
      cache[name] = fs.readJsonSync(dbFiles[name]);
    } catch {
      cache[name] = {};
    }
  }
  return cache[name];
}

function saveDb(name) {
  fs.writeJsonSync(dbFiles[name], cache[name], { spaces: 2 });
}

export const db = {
  users: {
    get: (id) => {
      const users = loadDb('users');
      if (!users[id]) {
        users[id] = {
          id,
          name: '',
          xp: 0,
          level: 1,
          balance: 1000,
          commandsUsed: 0,
          lastDaily: null,
          dailyStreak: 0,
          warnings: 0,
          banned: false,
          deviceSource: '',
          createdAt: Date.now(),
          inventory: [],
          lastSeen: Date.now(),
        };
        saveDb('users');
      }
      return users[id];
    },
    set: (id, data) => {
      const users = loadDb('users');
      users[id] = { ...users[id], ...data };
      saveDb('users');
      return users[id];
    },
    all: () => loadDb('users'),
    delete: (id) => {
      const users = loadDb('users');
      delete users[id];
      saveDb('users');
    },
    addXP: (id, amount) => {
      const users = loadDb('users');
      if (!users[id]) db.users.get(id);
      users[id].xp = (users[id].xp || 0) + amount;
      const newLevel = Math.floor(0.1 * Math.sqrt(users[id].xp)) + 1;
      const leveled = newLevel > (users[id].level || 1);
      users[id].level = newLevel;
      saveDb('users');
      return { xp: users[id].xp, level: users[id].level, leveled };
    },
    addBalance: (id, amount) => {
      const users = loadDb('users');
      if (!users[id]) db.users.get(id);
      users[id].balance = (users[id].balance || 0) + amount;
      saveDb('users');
      return users[id].balance;
    },
    deductBalance: (id, amount) => {
      const users = loadDb('users');
      if (!users[id]) db.users.get(id);
      if ((users[id].balance || 0) < amount) return false;
      users[id].balance -= amount;
      saveDb('users');
      return users[id].balance;
    },
  },
  groups: {
    get: (id) => {
      const groups = loadDb('groups');
      if (!groups[id]) {
        groups[id] = {
          id,
          name: '',
          antilink: false,
          antibot: false,
          welcome: false,
          welcomeMsg: 'Welcome @user to @group!',
          goodbye: false,
          goodbyeMsg: 'Goodbye @user from @group!',
          muted: false,
          adminsOnly: false,
          warnings: {},
          polls: [],
          createdAt: Date.now(),
        };
        saveDb('groups');
      }
      return groups[id];
    },
    set: (id, data) => {
      const groups = loadDb('groups');
      groups[id] = { ...groups[id], ...data };
      saveDb('groups');
      return groups[id];
    },
    all: () => loadDb('groups'),
    delete: (id) => {
      const groups = loadDb('groups');
      delete groups[id];
      saveDb('groups');
    },
  },
  settings: {
    get: () => loadDb('settings'),
    set: (data) => {
      const settings = loadDb('settings');
      Object.assign(settings, data);
      saveDb('settings');
      return settings;
    },
    getValue: (key) => {
      const settings = loadDb('settings');
      return settings[key];
    },
    setValue: (key, value) => {
      const settings = loadDb('settings');
      settings[key] = value;
      saveDb('settings');
    },
  },
  sessions: {
    get: () => loadDb('sessions'),
    set: (id, data) => {
      const sessions = loadDb('sessions');
      sessions[id] = { ...sessions[id], ...data };
      saveDb('sessions');
    },
    delete: (id) => {
      const sessions = loadDb('sessions');
      delete sessions[id];
      saveDb('sessions');
    },
    all: () => loadDb('sessions'),
  },
  reload: (name) => {
    if (name) {
      delete cache[name];
      loadDb(name);
    } else {
      Object.keys(cache).forEach(k => delete cache[k]);
      Object.keys(dbFiles).forEach(loadDb);
    }
  },
  backup: () => {
    const backupDir = path.join(dbDir, '../logs/backups');
    fs.ensureDirSync(backupDir);
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    Object.keys(dbFiles).forEach(name => {
      fs.copySync(dbFiles[name], path.join(backupDir, `${name}-${ts}.json`));
    });
    return backupDir;
  },
};

export default db;
