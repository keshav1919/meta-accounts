const config = require('./config');
const logger = require('./utils/logger');
const prisma = require('./database/prisma');
const { initBot } = require('./bot');
const { createApp } = require('./app');

const startServer = async () => {
  try {
    logger.info('Starting Telegram Inventory Bot service...');

    // 1. Initialize Bot
    const bot = initBot();

    // 2. Initialize Express App
    const app = createApp(bot);
    const server = app.listen(config.port, () => {
      logger.info(`HTTP Server listening on port ${config.port} (Render ready)`);
    });

    // 3. Start Bot in Webhook or Polling mode (Section 68)
    if (config.webhookUrl) {
      const webhookPath = `${config.webhookUrl.replace(/\/$/, '')}/telegram-webhook`;
      await bot.telegram.setWebhook(webhookPath);
      logger.info(`Telegram Bot running in WEBHOOK mode at ${webhookPath}`);
    } else {
      await bot.telegram.deleteWebhook({ drop_pending_updates: false });
      bot.launch({
        dropPendingUpdates: false,
        allowedUpdates: ['message', 'callback_query'],
        polling: {
          timeout: 25,
          limit: 100,
        },
      });
      logger.info('Telegram Bot running in POLLING mode (Optimized for RDP & High Concurrency)');
    }

    // 4. Graceful Shutdown Handlers (Section 67)
    const handleShutdown = async (signal) => {
      logger.info(`Received ${signal}. Initiating graceful shutdown...`);

      // Close HTTP server
      server.close(() => {
        logger.info('HTTP server closed.');
      });

      // Stop Bot polling/webhook
      try {
        bot.stop(signal);
        logger.info('Telegram bot stopped.');
      } catch (err) {
        logger.warn('Error stopping bot:', err.message);
      }

      // Disconnect Prisma Client
      try {
        await prisma.$disconnect();
        logger.info('Database disconnected.');
      } catch (err) {
        logger.warn('Error disconnecting database:', err.message);
      }

      process.exit(0);
    };

    process.once('SIGINT', () => handleShutdown('SIGINT'));
    process.once('SIGTERM', () => handleShutdown('SIGTERM'));

  } catch (err) {
    logger.error('Fatal initialization error:', err.message);
    process.exit(1);
  }
};

startServer();
