const cleanNumber = value => String(value || '').replace(/\D/g, '');
const envOwners = String(process.env.OWNER_NUMBERS || '')
  .split(',')
  .map(cleanNumber)
  .filter(Boolean);
const envSuperOwner = cleanNumber(process.env.SUPER_OWNER);
const configuredOwners = [...new Set([...envOwners, ...(envSuperOwner ? [envSuperOwner] : [])])];

const config = {
  botName: 'Jutts Bot',
  developer: 'Sajid Jutt',
  ownerName: 'Jutts Mods',
  brand: 'Jutts Mods',
  version: '3.0.0',
  // Production operators should set SUPER_OWNER/OWNER_NUMBERS in .env. When
  // omitted, the first successfully linked WhatsApp session becomes super owner.
  ownerNumber: configuredOwners,
  superOwner: envSuperOwner,
  channelLink: '',
  newsletterJid: '',
  newsletterName: 'Jutts Bot',
  prefix: ['.', '!', '#'],
  altPrefixes: [],
  owners: configuredOwners,
  botMode: 'public',
  sessionDir: './session',
  databaseDir: './database',
  logsDir: './logs',
  tempDir: './temp',
  mediaDir: './media',
  maxFileSize: 50 * 1024 * 1024,
  autoRead: true,
  autoTyping: true,
  antiSpam: true,
  spamInterval: 5,
  spamMax: 5,
  cooldown: 3,
  xpPerMessage: 5,
  xpPerCommand: 10,
  startingBalance: 1000,
  dailyAmount: 500,
  maxDailyStreak: 7,
  maintenanceMode: false,
  maintenanceMsg: '🔧 Bot is under maintenance. Please wait...',
  welcomeMessage: true,
  timezone: 'Asia/Karachi',
  language: 'en',
  autoStatusView: true,
  autoStatusReact: true,
  autoStatus: false,
  statusEmoji: '❤️',
  apiKeys: {
    openweather: process.env.OPENWEATHER_API_KEY || '',
    omdb: process.env.OMDB_API_KEY || '',
  },
};

export default config;
