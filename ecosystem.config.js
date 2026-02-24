module.exports = {
  apps: [
    {
      name: 'shifocrm-telegram-bot',
      script: 'src/index.js',
      instances: 1,
      exec_mode: 'fork', // cluster emas, fork mode
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
      },
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
    },
  ],
};
