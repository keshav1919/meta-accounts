const express = require('express');
const logger = require('./utils/logger');

const createApp = (bot = null) => {
  const app = express();

  // Basic security and json parser
  app.use(express.json());

  // Render Health Check Endpoints (Section 66)
  app.get('/', (req, res) => {
    res.status(200).json({
      status: 'ok',
      service: 'telegram-account-bot',
      timestamp: new Date().toISOString(),
    });
  });

  app.get('/health', (req, res) => {
    res.status(200).json({
      status: 'healthy',
      uptime: process.uptime(),
    });
  });

  // Attach Telegram Webhook if bot provided
  if (bot) {
    app.use(bot.webhookCallback('/telegram-webhook'));
  }

  // 404 Handler
  app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  return app;
};

module.exports = {
  createApp,
};
