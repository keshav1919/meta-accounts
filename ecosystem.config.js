module.exports = {
  apps: [
    {
      name: 'meta-acc-bot',
      script: 'src/server.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '300M',
      node_args: '--max-old-space-size=256',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
