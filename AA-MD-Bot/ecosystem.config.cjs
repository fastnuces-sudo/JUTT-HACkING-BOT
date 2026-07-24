// PM2 Ecosystem Config — AA MD Bot (Oracle Cloud)
// Usage:
//   pm2 start ecosystem.config.cjs          # start
//   pm2 restart ecosystem.config.cjs        # restart
//   pm2 logs aa-md-bot                      # view logs
//   pm2 monit                               # live monitor

require('dotenv').config();

module.exports = {
  apps: [
    {
      name        : 'aa-md-bot',
      script      : 'index.js',
      interpreter : 'node',
      node_args   : '--experimental-vm-modules',

      // Restart policy
      autorestart  : true,
      watch        : false,
      max_restarts : 10,
      restart_delay: 5000,          // 5s between restarts
      min_uptime   : '30s',

      // Memory guard — restart if over 1.5 GB
      max_memory_restart: '1500M',

      // Logs
      log_date_format : 'YYYY-MM-DD HH:mm:ss',
      out_file        : './logs/pm2-out.log',
      error_file      : './logs/pm2-err.log',
      merge_logs      : true,

      // Environment
      env: {
        NODE_ENV  : 'production',
        PORT      : process.env.PORT      || 5000,
        SERVER_ID : process.env.SERVER_ID || 'server-1',
      },
    },
  ],
};
